// ---- dropped items ----
const droppedItems=[],DG=new THREE.BoxGeometry(.22,.22,.22),DMs={},dropMat=c=>DMs[c]||(DMs[c]=new THREE.MeshLambertMaterial({color:c}));
const dropColors={};
function itemColor(id){
 const q=ITEMS[id];
 if(q?.type==='food')return 0xc88a3a;
 if(q?.type==='weapon')return 0xaaaaaa;
 if(q?.type==='tool')return 0x777777;
 if(q?.type==='armor')return 0x888888;
 if(q?.type==='material')return 0xb050d0;
 return 0x8b8b8b;
}
function spawnDrop(id,n,x,y,z,vx=0,vz=0,vy0=1.8){
 if(!n)return;
 const g=new THREE.Group();
 const m=new THREE.Mesh(DG,dropMat(itemColor(id)));
 g.add(m);scene.add(g);
 droppedItems.push({id,n,g,x,y,z,vy:vy0,vx,vz,t:Math.random()*6.28,spin:1.6,gt:0,gy:y,age:0});
}
function dropSelected(){
 const id=hot[sel];
 if(id==null)return;
 if(!ITEMS[id] && !(invCount[id]>0)){toast('落とせるアイテムがありません');return}
 if(!take(id,1))return;
 spawnDrop(id,1,P.x+Math.sin(P.yaw)*.8,P.y+1.0,P.z+Math.cos(P.yaw)*.8);
 toast((ITEMS[id]?.name||'アイテム')+'を落としました');
}
function advanceDropMotion(d,dt){
 if((d.gt-=dt)<=0){
  d.gt=.5;
  d.gy=surfY(Math.floor(d.x),Math.floor(d.z))+1.05;
 }
 const groundY=d.gy;
 d.y+=d.vy*dt;
 d.vy-=12*dt;
 if(d.vx||d.vz){
  d.x+=d.vx*dt;
  d.z+=d.vz*dt;
  const friction=Math.max(0,1-3*dt);
  d.vx*=friction;
  d.vz*=friction;
 }
 if(d.y<groundY){d.y=groundY;d.vy=0;}
}
function applyDropFlow(d,dt){
 updFlow(d,Math.floor(d.x),[d.y-.2,d.y-1.1,d.y-1.9],Math.floor(d.z),dt);
 if(!(d.fx||d.fz))return;
 const nextX=d.x+d.fx*dt,nextZ=d.z+d.fz*dt,blockY=Math.floor(d.y-.5);
 if(!solid(getB(Math.floor(nextX),blockY,Math.floor(d.z))))d.x=nextX;
 if(!solid(getB(Math.floor(d.x),blockY,Math.floor(nextZ))))d.z=nextZ;
}
function updateDropVisual(d){
 d.g.position.set(d.x,d.y+.12*Math.sin(d.t*2),d.z);
 d.g.rotation.y=d.t;
}
function dropTick(dt){
 for(let i=droppedItems.length-1;i>=0;i--){
  const d=droppedItems[i];
  d.t+=dt*d.spin;
  if((d.age+=dt)>240){
   scene.remove(d.g);
   droppedItems.splice(i,1);
   continue;
  }

  advanceDropMotion(d,dt);
  applyDropFlow(d,dt);
  updateDropVisual(d);
  if(Math.hypot(d.x-P.x,d.y-P.y,d.z-P.z)<1.45){
   give(d.id,d.n);
   scene.remove(d.g);
   droppedItems.splice(i,1);
   toast((ITEMS[d.id]?.name||'アイテム')+'を拾った');
  }
 }
}
