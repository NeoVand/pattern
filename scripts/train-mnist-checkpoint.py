"""Reproduce Pattern's GELU variational MNIST starting point.
Same reparameterized Gaussian waist/MSE+KL objective as the JaxJS worker.
No labels are read. Requires NumPy and Pillow; run with [steps=10000].
"""
from pathlib import Path
import json, sys, time, hashlib
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];DATA=ROOT/'static/data'
SHAPE=[784,128,32,2,32,128,784];BETA=1/784;BATCH=128;RATE=0.003

def images(name,count):
    a=np.array(Image.open(DATA/name).convert('L'))
    return a.reshape(count//100,28,100,28).transpose(0,2,1,3).reshape(count,784).astype(np.float32)/255
x=images('mnist-train.png',8000);test=images('mnist-test.png',2000);rng=np.random.default_rng(7)
w=[];b=[]
for i in range(6):
    n=4 if i==2 else SHAPE[i+1];scale=np.sqrt(6/SHAPE[i])*(.4 if i==5 else 1)
    w.append(rng.uniform(-scale,scale,(n,SHAPE[i])).astype(np.float32));b.append(np.zeros(n,np.float32))
m=[np.zeros_like(a) for a in w+b];v=[np.zeros_like(a) for a in w+b]
def gelu(z):return .5*z*(1+np.tanh(np.sqrt(2/np.pi)*(z+.044715*z**3)))
def dgelu(z):
    t=np.tanh(np.sqrt(2/np.pi)*(z+.044715*z**3))
    return .5*(1+t)+.5*z*(1-t*t)*np.sqrt(2/np.pi)*(1+3*.044715*z*z)
def forward(a,noise=None):
    h=[a];zs=[];moments=None
    for i,(wi,bi) in enumerate(zip(w,b)):
        z=h[-1]@wi.T+bi;zs.append(z)
        if i==2:
            moments=z;h.append(z[:,:2] if noise is None else z[:,:2]+np.exp(z[:,2:]/2)*noise)
        else:h.append(z if i==5 else gelu(z))
    return h,zs,moments

def mse(a):return float(np.mean((a-forward(a)[0][-1])**2))
def save(step,started):
    packed=np.concatenate([a.ravel() for pair in zip(w,b) for a in pair]).astype('<f4');packed.tofile(DATA/'mnist-autoencoder.f32')
    z=forward(test)[0][3]
    info={'model':'variational autoencoder','architecture':SHAPE,'latentHead':'2 means + 2 log variances','activation':'GELU hidden, linear Gaussian mean/log-variance and readout','objective':'mean pixel MSE + (1/784) * mean Gaussian KL','optimizer':'Adam beta1=0.9 beta2=0.99 eps=1e-8','learningRate':RATE,'batchSize':BATCH,'updates':step,'trainingImages':8000,'heldOutImages':2000,'seed':7,'trainMSE':mse(x[:256]),'heldOutMSE':mse(test),'latentMin':z.min(0).tolist(),'latentMax':z.max(0).tolist(),'trainingSeconds':round(time.time()-started,2),'weightsFormat':'little-endian float32; each layer output-major weights then biases; latent layer has four outputs','labelsUsed':False,'sha256':hashlib.sha256(packed.tobytes()).hexdigest()}
    (DATA/'mnist-autoencoder.json').write_text(json.dumps(info,indent=2)+'\n');print(json.dumps(info),flush=True)
steps=int(sys.argv[1]) if len(sys.argv)>1 else 10000;started=time.time()
print('initial heldout MSE',mse(test),flush=True)
for step in range(1,steps+1):
    batch=x[rng.integers(0,len(x),BATCH)];noise=rng.standard_normal((BATCH,2)).astype(np.float32)
    h,zs,moments=forward(batch,noise);delta=2*(h[-1]-batch)/(BATCH*784);gw=[None]*6;gb=[None]*6
    for i in range(5,-1,-1):
        if i==2:delta=np.concatenate([delta+BETA*moments[:,:2]/BATCH,delta*noise*.5*np.exp(moments[:,2:]/2)+BETA*.5*(np.exp(moments[:,2:])-1)/BATCH],1)
        elif i<5:delta*=dgelu(zs[i])
        gw[i]=delta.T@h[i];gb[i]=delta.sum(0)
        if i:delta=delta@w[i]
    for i,(a,g) in enumerate(zip(w+b,gw+gb)):
        m[i]=.9*m[i]+.1*g;v[i]=.99*v[i]+.01*g*g;a-=RATE*(m[i]/(1-.9**step))/(np.sqrt(v[i]/(1-.99**step))+1e-8)
    if step%500==0:print(step,'heldoutMSE',mse(test[:512]),'seconds',round(time.time()-started,1),flush=True)
    if step==steps:save(step,started)
