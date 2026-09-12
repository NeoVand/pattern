"""Train Pattern's small, inspectable Fashion-MNIST convolutional classifier.

Reproduce with: python scripts/train-convnet-checkpoint.py [epochs=35]
Requires PyTorch, NumPy, Pillow. Uses only bundled official training images for
updates (first 10,000); selects checkpoint on the remaining 2,000 training
images. The bundled official test split is evaluated once after selection.
The exported OIHW kernels exactly match lax.conv's NCHW convention.
"""
from pathlib import Path
import copy, hashlib, json, sys, time
import numpy as np
from PIL import Image
import torch
from torch import nn

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'static/data'
SEED = 37
TRAIN = 10000
BATCH = 128
EPOCHS = int(sys.argv[1]) if len(sys.argv) > 1 else 35
torch.manual_seed(SEED)
torch.set_num_threads(6)
device = torch.device('mps' if torch.backends.mps.is_available() else 'cpu')
meta = json.loads((DATA / 'fashion-meta.json').read_text())

def sheet(name, count):
    pixels = np.array(Image.open(DATA / name).convert('L'))
    return pixels.reshape(count // meta['cols'], 28, meta['cols'], 28).transpose(0, 2, 1, 3).reshape(count, 1, 28, 28).astype(np.float32) / 255

class Convnet(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv2d(1, 8, 3, stride=2, padding=1)
        self.conv2 = nn.Conv2d(8, 16, 3, stride=2, padding=1)
        self.conv3 = nn.Conv2d(16, 24, 3, stride=2, padding=1)
        self.head = nn.Linear(24 * 4 * 4, 10)
    def forward(self, x, activations=False):
        a = torch.relu(self.conv1(x))
        b = torch.relu(self.conv2(a))
        c = torch.relu(self.conv3(b))
        y = self.head(c.flatten(1))
        return [a,b,c,y] if activations else y

all_train = torch.from_numpy(sheet('fashion-train.png', meta['train']))
labels = np.fromfile(DATA / 'fashion-labels.bin', dtype=np.uint8)
assert len(labels) == meta['train'] + meta['test']
all_y = torch.from_numpy(labels[:meta['train']].astype(np.int64))
x = all_train[:TRAIN].to(device); y = all_y[:TRAIN].to(device)
vx = all_train[TRAIN:].to(device); vy = all_y[TRAIN:].to(device)
model = Convnet().to(device)
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
criterion = nn.CrossEntropyLoss()
start = time.time(); best = float('inf'); best_state = None; best_epoch = 0; history = []

def evaluate(x, y):
    total_loss = 0.; total_correct = 0
    with torch.no_grad():
        for offset in range(0, len(x), 256):
            logits = model(x[offset:offset+256])
            total_loss += criterion(logits, y[offset:offset+256]).item() * len(logits)
            total_correct += (logits.argmax(1) == y[offset:offset+256]).sum().item()
    return {'loss': total_loss / len(x), 'accuracy': total_correct / len(x), 'count': len(x)}

print('device', device, 'parameters',sum(p.numel() for p in model.parameters()), flush=True)
for epoch in range(1,EPOCHS+1):
    model.train(); order = torch.randperm(TRAIN, device=device); train_loss = 0
    for offset in range(0,TRAIN,BATCH):
        idx=order[offset:offset+BATCH]
        optimizer.zero_grad(); loss=criterion(model(x[idx]),y[idx]);loss.backward();optimizer.step()
        train_loss += loss.item()*len(idx)
    model.eval(); val=evaluate(vx,vy)
    history.append({'epoch':epoch,'trainLoss':train_loss/TRAIN,'validationLoss':val['loss'],'validationAccuracy':val['accuracy']})
    if val['loss'] < best:
        best=val['loss']; best_state=copy.deepcopy(model.state_dict()); best_epoch=epoch
    print(json.dumps(history[-1]),'seconds',round(time.time()-start,1),flush=True)

model.load_state_dict(best_state); model.eval()
test_np=sheet('fashion-test.png',meta['test']);test_x=torch.from_numpy(test_np).to(device)
test_y=torch.from_numpy(labels[meta['train']:].astype(np.int64)).to(device)
test=evaluate(test_x,test_y); validation=evaluate(vx,vy); train=evaluate(x,y)
packed=np.concatenate([p.detach().cpu().numpy().ravel() for p in model.parameters()]).astype('<f4')
packed.tofile(DATA/'fashion-convnet.f32')
with torch.no_grad():
    acts=model(test_x[:1],True)
    reference={'pixels':test_x[0].cpu().numpy().ravel().tolist(),'testIndex':0,'label':int(test_y[0]),'logits':acts[-1][0].cpu().tolist(),'activations':[a[0].cpu().numpy().ravel().tolist() for a in acts[:-1]]}
    scores=torch.cat([model(test_x[i:i+256]) for i in range(0,len(test_x),256)]).softmax(1).cpu().numpy()
    mistakes=np.flatnonzero(scores.argmax(1)!=test_y.cpu().numpy()).tolist()
info={'architecture':{'channels':[1,8,16,24],'kernel':3,'stride':2,'padding':1,'spatial':[28,14,7,4],'head':[384,10]},'activation':'ReLU after each convolution; softmax for displayed probabilities','parameterCount':len(packed),'trainingImages':TRAIN,'validationImages':meta['train']-TRAIN,'heldOutImages':meta['test'],'epochs':best_epoch,'candidateEpochs':EPOCHS,'seed':SEED,'optimizer':'Adam','learningRate':0.001,'batchSize':BATCH,'train':train,'validation':validation,'test':test,'heldOutMistakes':mistakes,'history':history,'reference':reference,'format':'little-endian float32; conv1 OIHW weights then bias, conv2 weights then bias, conv3 weights then bias, head output-major weights then bias','trainingSeconds':round(time.time()-start,2),'sha256':hashlib.sha256(packed.tobytes()).hexdigest(),'sources':{name:hashlib.sha256((DATA/name).read_bytes()).hexdigest() for name in ['fashion-train.png','fashion-test.png','fashion-labels.bin','fashion-meta.json']}}
(DATA/'fashion-convnet.json').write_text(json.dumps(info,indent=2)+'\n')
print('FINAL',json.dumps({k:v for k,v in info.items() if k not in ['reference','history','heldOutMistakes','sources']}),flush=True)
