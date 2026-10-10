// No file IO, networking, content logs, or persistent parser cache.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require('pdf-parse');
process.once('message', async (workerData) => {
 let parser;
 let response;
 try {
  parser = new PDFParse({ data: new Uint8Array(workerData.bytes), verbosity: 0, isEvalSupported: false });
  const info = await parser.getInfo();
  if(info.total > workerData.pages)throw {code:'PDF_PAGE_LIMIT'};
  let text='';let emptyPages=0;
  for(let page=1;page<=info.total;page++){
   const result=await parser.getText({partial:[page],pageJoiner:''});
   if(!result.text.trim())emptyPages++;
   text+=result.text+'\n';
   if(text.length>workerData.text)throw {code:'PDF_TEXT_LIMIT'};
  }
  if(text.trim().length<40)throw {code:'PDF_INSUFFICIENT_TEXT'};
  response={text,warnings:emptyPages?['Some pages contain no readable text. No OCR was performed.']:[]};
 }catch(error){
  const code=error.code|| (error.name==='PasswordException'?'PDF_ENCRYPTED':error.name==='InvalidPDFException'?'PDF_MALFORMED':'PDF_UNSUPPORTED');
  response={code};
 }finally{if(parser)await parser.destroy();}
 process.send(response);
});
