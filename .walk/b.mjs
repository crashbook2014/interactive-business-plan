import {open,dump} from './lib.mjs';
const {b,p}=await open();
for(let i=2;i<=4;i++){
  await p.getByText('التالي',{exact:true}).last().click();
  await p.waitForTimeout(700);
  await dump(p,'0'+i+'-onboard');
}
