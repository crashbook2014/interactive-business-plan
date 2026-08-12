import {open,dump} from './lib.mjs';
const {b,p}=await open();
await dump(p,'01-home-default');
await b.close();
