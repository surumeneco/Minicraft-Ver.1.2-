const chestUI=document.getElementById('chestUI'),chestBody=document.getElementById('chestBody');let chestKey=null;

function openChest(x,y,z){
 chestKey=x+','+y+','+z;
 const bsx=getB(x,y,z)&255;
 if(!chests[chestKey])chests[chestKey]=Array(CONTB.get(bsx)||27).fill(null);
 chestUI.querySelector('h2').textContent=NMS[bsx]||'チェスト';
 inv=true;
 invEl.style.display='none';
 chestUI.style.display='flex';
 if(document.pointerLockElement)document.exitPointerLock();
 renderChest();
}
function closeChest(){
 chestKey=null;
 chestUI.style.display='none';
 inv=false;
 try{cv.requestPointerLock()}catch(e){}
}
function breakChest(x,y,z){
 const key=x+','+y+','+z,contents=chests[key];
 if(contents){
  for(const slot of contents){
   if(slot)spawnDrop(slot[0],slot[1],x+.5,y+.7,z+.5);
  }
 }
 delete chests[key];
 give(CHEST,1);
}

// Fill matching stacks first, then empty slots. Returns the number moved.
function moveIntoChest(contents,id,requested){
 let moved=0;
 for(const slot of contents){
  if(!slot||slot[0]!==id||slot[1]>=64||moved>=requested)continue;
  const amount=Math.min(64-slot[1],requested-moved);
  slot[1]+=amount;
  moved+=amount;
 }
 for(let i=0;i<contents.length&&moved<requested;i++){
  if(contents[i])continue;
  const amount=Math.min(64,requested-moved);
  contents[i]=[id,amount];
  moved+=amount;
 }
 return moved;
}
function chestPut(id,all){
 const contents=chests[chestKey];
 if(!contents||!(invCount[id]>0))return;
 const requested=all?Math.min(invCount[id],64):1;
 const moved=moveIntoChest(contents,id,requested);
 if(!moved)return toast('チェストがいっぱいです');
 take(id,moved);
 renderChest();
}
function chestGet(i,all){
 const contents=chests[chestKey],slot=contents&&contents[i];
 if(!slot)return;
 const amount=all?slot[1]:1;
 give(slot[0],amount);
 slot[1]-=amount;
 if(slot[1]<=0)contents[i]=null;
 renderChest();
}

// Each section uses the same item display and mouse conventions.
function appendChestSection(title,entries,onAll,onOne){
 const heading=document.createElement('div');
 heading.className='invTitle';
 heading.textContent=title;
 chestBody.appendChild(heading);

 const grid=document.createElement('div');
 grid.className='chGrid';
 for(const {slot,key} of entries){
  const cell=document.createElement('div');
  cell.className='it';
  if(slot){
   const id=slot[0];
   cell.title=ITEMS[id]?ITEMS[id].name:(NM[id]||'');
   cell.innerHTML=invIcon(id).replace(/<u>.*?<\/u>/,'')+`<u>${slot[1]}</u>`;
  }
  cell.onclick=()=>onAll(key);
  cell.oncontextmenu=event=>{event.preventDefault();onOne(key);};
  grid.appendChild(cell);
 }
 chestBody.appendChild(grid);
}
function renderChest(){
 const contents=chests[chestKey];
 if(!contents)return;
 chestBody.innerHTML='';
 appendChestSection(
  'チェストの中身',
  contents.map((slot,index)=>({slot,key:index})),
  index=>chestGet(index,true),
  index=>chestGet(index,false)
 );
 const ids=Object.keys(invCount).map(Number).filter(id=>invCount[id]>0);
 appendChestSection(
  '持ち物（クリックでチェストへ）',
  ids.map(id=>({slot:[id,invCount[id]],key:id})),
  id=>chestPut(id,true),
  id=>chestPut(id,false)
 );
}
