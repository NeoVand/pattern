"""Interpret the saved Fashion-MNIST checkpoint without changing its weights.

Run with Python + PyTorch + NumPy + Pillow. Rank the strongest interior response
per training image, then retain six distinct images per channel. Optimize an
input patch for one unit with fixed weights; only the pixels are updated.
"""
from pathlib import Path
import hashlib, json
import numpy as np
from PIL import Image, ImageDraw
import torch
from torch import nn
ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'static/data'
OUT=ROOT/'test-results/feature-hierarchy'
OUT.mkdir(parents=True,exist_ok=True)
torch.manual_seed(82);torch.set_num_threads(4)
class Model(nn.Module):
 def __init__(self):
  super().__init__();self.layers=nn.ModuleList([nn.Conv2d(a,b,3,2,1) for a,b in [(1,8),(8,16),(16,24)]]);self.head=nn.Linear(384,10)
 def forward(self,x,raw=False):
  maps=[]
  for conv in self.layers:
   z=conv(x);x=torch.relu(z);maps.append(z if raw else x)
  return maps
model=Model();packed=np.fromfile(DATA/'fashion-convnet.f32',dtype='<f4');offset=0
for p in model.parameters():
 n=p.numel();p.data.copy_(torch.from_numpy(packed[offset:offset+n].reshape(p.shape)));offset+=n;p.requires_grad_(False)
assert offset==len(packed)==8578
meta=json.loads((DATA/'fashion-meta.json').read_text())
raw=np.array(Image.open(DATA/'fashion-train.png').convert('L'))
x=raw.reshape(meta['train']//100,28,100,28).transpose(0,2,1,3).reshape(-1,1,28,28)[:2000].astype(np.float32)/255
labels=np.fromfile(DATA/'fashion-labels.bin',dtype=np.uint8)[:2000]
all_maps=[[],[],[]]
with torch.no_grad():
 for start in range(0,len(x),128):
  for layer,a in enumerate(model(torch.from_numpy(x[start:start+128]))):all_maps[layer].append(a)
all_maps=[torch.cat(a).numpy() for a in all_maps]
layers=[]
for layer,(count,side) in enumerate([(8,14),(16,7),(24,4)]):
 size=2**(layer+2)-1;stride=2**(layer+1);radius=size//2;center=side//2;origin=center*stride-radius
 maps=all_maps[layer];valid=[i for i in range(side) if i*stride-radius>=0 and i*stride+radius<28]
 scores=maps[:,:,valid,:][:,:,:,valid].reshape(len(x),count,-1);locations=scores.argmax(-1);peaks=scores.max(-1)
 # Three independently initialized searches for each feature, all with the same budget.
 channels=torch.arange(count).repeat_interleave(3);batch=len(channels)
 logits=torch.randn(batch,1,size,size,requires_grad=True)*.35;logits=logits.detach().requires_grad_(True)
 optimizer=torch.optim.Adam([logits],lr=.075);frames=[];steps=[0,5,15,40,100,220]
 for step in range(221):
  patch=logits.sigmoid();image=torch.nn.functional.pad(patch,(origin,28-origin-size,origin,28-origin-size))
  response=model(image,True)[layer][torch.arange(batch),channels,center,center]
  if step in steps:frames.append(patch.detach().clone())
  if step==220:break
  tv=(patch[:,:,1:]-patch[:,:,:-1]).square().mean((1,2,3))+(patch[:,:,:,1:]-patch[:,:,:,:-1]).square().mean((1,2,3))
  penalty=.035*tv+.01*patch.square().mean((1,2,3));loss=(-response+penalty).sum()
  optimizer.zero_grad();loss.backward();optimizer.step()
 best=(response.reshape(count,3).argmax(1)+torch.arange(count)*3).tolist()
 features=[]
 for channel in range(count):
  ranking=np.argsort(-peaks[:,channel],kind='stable')[:6];examples=[]
  for index in ranking:
   pos=locations[index,channel];cy=valid[pos//len(valid)];cx=valid[pos%len(valid)]
   examples.append({'index':int(index),'label':int(labels[index]),'x':int(cx),'y':int(cy),'score':round(float(peaks[index,channel]),6)})
  patterns=[np.round(f[best[channel],0].numpy().ravel(),5).tolist() for f in frames]
  features.append({'channel':channel,'patterns':patterns,'examples':examples})
 layers.append({'layer':layer,'size':size,'side':side,'channels':features})
 # A scientific contact sheet: preferred input patch and actual highest-response crops.
 sheet=Image.new('RGB',(1120,count*106),(237,240,246));draw=ImageDraw.Draw(sheet)
 for ch,feature in enumerate(features):
  yy=ch*106;draw.text((8,yy+8),f'L{layer+1} / {ch+1}',fill=(40,54,75))
  preferred=np.array(feature['patterns'][-1]).reshape(size,size)
  sheet.paste(Image.fromarray((preferred*255).astype('uint8')).resize((78,78),Image.Resampling.NEAREST),(86,yy+8))
  for j,ex in enumerate(feature['examples']):
   sx=ex['x']*stride-radius;sy=ex['y']*stride-radius;im=x[ex['index'],0];crop=im[sy:sy+size,sx:sx+size]
   xx=182+j*146;sheet.paste(Image.fromarray((crop*255).astype('uint8')).resize((76,76),Image.Resampling.NEAREST),(xx,yy+8))
   thumb=Image.fromarray((im*255).astype('uint8')).convert('RGB').resize((48,48),Image.Resampling.NEAREST)
   td=ImageDraw.Draw(thumb);td.rectangle((sx/28*48,sy/28*48,(sx+size)/28*48,(sy+size)/28*48),outline=(190,160,240),width=1)
   sheet.paste(thumb,(xx+80,yy+8));draw.text((xx,yy+85),f'{ex["label"]} / {ex["score"]:.2f}',fill=(40,54,75))
 sheet.save(OUT/f'layer-{layer+1}.png')
 print('layer',layer+1,'done',flush=True)
result={'checkpointSha256':hashlib.sha256(packed.tobytes()).hexdigest(),'dataset':'Fashion-MNIST, first 2000 bundled training images; no test images','sampleCount':2000,'seed':82,'steps':steps,'method':'Top interior post-ReLU response per distinct training image. Input optimization: fixed weights; 3 starts, 220 Adam updates at 0.075; sigmoid bounded pixels; 0.035 squared total variation + 0.01 mean squared pixels. Best final pre-ReLU response retained.','layers':layers}
(OUT/'optimized-patterns.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
for layer in result['layers']:
 for feature in layer['channels']: feature.pop('patterns')
(DATA/'fashion-feature-atlas.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
