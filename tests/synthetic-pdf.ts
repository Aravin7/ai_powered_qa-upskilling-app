// Generated entirely from synthetic strings; no personal CV fixture is checked in.
export function syntheticPdf(lines=['Synthetic QA experience','I designed test design cases for a synthetic login form.','I performed API testing for a local sample service.','I used Playwright to automate three synthetic browser checks.']){
 const escaped=lines.map(line=>line.replace(/([\\()])/g,'\\$1'));
 const stream=`BT /F1 12 Tf 50 750 Td ${escaped.map((s,i)=>`${i?'0 -20 Td ':''}(${s}) Tj`).join('\n')} ET`;
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
 let file='%PDF-1.4\n';const offsets=[0];
 objects.forEach((object,i)=>{offsets.push(Buffer.byteLength(file));file+=`${i+1} 0 obj\n${object}\nendobj\n`;});
 const xref=Buffer.byteLength(file);file+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 return new Uint8Array(Buffer.from(file));
}

// One-page PDF with a real image XObject and no text operators. The parser must
// report no readable text; OCR is outside the approved local workflow.
export function syntheticImagePdf(){
 const stream='q 72 0 0 72 50 650 cm /Im1 Do Q';
 const image=Buffer.from([255,0,0]);
 const objects=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>',
  `<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${image.length} >>\nstream\n${image.toString('latin1')}\nendstream`,
  `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
 ];
 let file=Buffer.from('%PDF-1.4\n','latin1');const offsets=[0];
 for(let i=0;i<objects.length;i++){offsets.push(file.length);file=Buffer.concat([file,Buffer.from(`${i+1} 0 obj\n${objects[i]}\nendobj\n`,'latin1')]);}
 const xref=file.length;
 file=Buffer.concat([file,Buffer.from(`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`,'latin1')]);
 return new Uint8Array(file);
}

export function syntheticPagedPdf(pages:string[][]){
 const pageIds=pages.map((_,index)=>index+3);
 const fontId=pages.length+3;
 const firstContentId=pages.length+4;
 const streams=pages.map(lines=>{
  const escaped=lines.map(line=>line.replace(/([\\()])/g,'\\$1'));
  return escaped.length?`BT /F1 12 Tf 50 750 Td ${escaped.map((line,index)=>`${index?'0 -20 Td ':''}(${line}) Tj`).join('\n')} ET`:'';
 });
 const objects=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  `<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  ...pages.map((_,index)=>`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${firstContentId+index} 0 R >>`),
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ...streams.map(stream=>`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`),
 ];
 let file='%PDF-1.4\n';const offsets=[0];
 objects.forEach((object,index)=>{offsets.push(Buffer.byteLength(file));file+=`${index+1} 0 obj\n${object}\nendobj\n`;});
 const xref=Buffer.byteLength(file);
 file+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>`${String(offset).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 return new Uint8Array(Buffer.from(file));
}
