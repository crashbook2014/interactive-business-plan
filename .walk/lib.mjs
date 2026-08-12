import { chromium } from 'playwright';
const SP='/tmp/claude-0/-home-user-interactive-business-plan/3a127398-16c7-5b1d-a529-ca11eb3e3591/scratchpad/shots/';
export async function open(w=390,h=844){
  const b = await chromium.launch({args:['--no-sandbox'],executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const p = await b.newPage({viewport:{width:w,height:h}});
  await p.goto('http://127.0.0.1:8099/app/index.html');
  await p.waitForTimeout(1200);
  return {b,p};
}
export async function dump(p,name){
  await p.screenshot({path:SP+name+'.png', fullPage:true});
  const info = await p.evaluate(()=>({
    dir: document.documentElement.dir||getComputedStyle(document.body).direction,
    lang: document.documentElement.lang,
    text: document.body.innerText
  }));
  console.log('\n===== '+name+'  [dir='+info.dir+' lang='+info.lang+'] url='+p.url()+' =====');
  console.log(info.text);
}
