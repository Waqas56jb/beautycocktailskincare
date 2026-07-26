import { handleChat } from '../src/services/chat.service.js'
const link=/leadconnectorhq\.com\/booking/i
const P='+15551239876'
let cid=null
const say=async(t)=>{const r=await handleChat({conversationId:cid,text:t,channel:'whatsapp',visitor:{phone:P,name:'Sara'}});cid=r.conversationId;return (r.reply||'(none)').replace(/\n+/g,' ')}

console.log('1) hi            ->', (await say('hi')).slice(0,85))
console.log('2) I need appointment ->', (await say('I need appointment')).slice(0,95))
const r3=await say('facial + consultation'); console.log('3) facial+consult ->', r3.slice(0,90), link.test(r3)?'[LINK ✓]':'[no link]')
console.log('4) what are your prices ->', (await say('what are your prices?')).slice(0,95))
console.log('5) is there parking ->', (await say('is there parking?')).slice(0,80))
console.log('6) how are you   ->', (await say('how are you?')).slice(0,80))
// hallucination probe — laser is NOT a service
const r7=await say('do you do laser hair removal? how much?')
console.log('7) laser (probe) ->', r7.slice(0,110), /\$\d/.test(r7)&&!/confirm|not sure|check|team|jt|don't (currently )?offer|women-based/i.test(r7)?'[⚠️ invented?]':'[grounded ✓]')
