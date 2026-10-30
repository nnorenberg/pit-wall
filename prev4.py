h=open('apex-school.html').read()
test="""<style id="hide"></style><script>window.addEventListener('error',e=>console.log('PAGEERR '+e.message+' @'+e.lineno));setTimeout(()=>{const q=new URLSearchParams(location.search);
const fire=(id,v)=>{const s=document.getElementById(id);s.value=v;s.dispatchEvent(new Event('change'));};
try{
if(q.get('cls'))fire('cls',q.get('cls'));
if(q.get('trk'))fire('trk',q.get('trk'));
if(q.get('sess')){document.querySelector('#mode [data-m="weekend"]').click();fire('sess',q.get('sess'));document.getElementById('sess-go').click();}
if(q.get('spd'))document.querySelector('#speeds [data-s="'+q.get('spd')+'"]').click();
if(q.get('only'))document.getElementById('hide').textContent='.wrap > *:not('+q.get('only')+'){display:none!important}';
if(q.get('debrief'))document.getElementById('debrief-now').click();
}catch(e){console.log('PAGEERR '+e.message+' '+e.stack)}},300);</script>"""
open('preview.html','w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>'+h+test+'</body></html>')
