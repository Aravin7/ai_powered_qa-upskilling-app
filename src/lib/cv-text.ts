import { catalogue } from './catalogue';

export type CvSection='summary'|'experience'|'projects'|'technologies'|'certifications'|'uncertain';
export type CvBlock={id:string;section:CvSection;text:string};
export type PreparedCv={text:string;blocks:CvBlock[];warnings:string[]};
const headings:[RegExp,CvSection|'excluded'][]=[
 [/^(?:(?:professional|career|personal)\s+)?(?:summary|profile|highlights)$/i,'summary'],
 [/^(?:(?:professional|work|relevant)\s+)?experience$|^(?:employment|career|work) history$/i,'experience'],
 [/^(?:(?:selected|relevant|professional|personal)\s+)?projects$/i,'projects'],
 [/^(?:(?:technical|professional|core)\s+)?skills$|^core competencies(?:\s*&\s*tools)?$|^testing methodologies$|^tools(?:\s*(?:and|&)\s*(?:technologies|platforms))?$|^database(?:\s*(?:and|&)\s*environment)?$|^(?:known )?technologies(?: list)?$|^technical expertise$/i,'technologies'],
 [/^certifications?$/i,'certifications'],
 [/^(?:education(?:\s*(?:and|&)\s*certifications?)?|academic(?: qualifications| background)?|qualifications|extra[ -]?curricular(?: activities)?|interests|hobbies|references|personal (?:information|details)|contact(?: details| information)?|job requirements?|requirements?|objectives?|aspirations?|future learning|skills to (?:learn|develop)|desired qualifications)$/i,'excluded'],
];
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const bounded=(s:string)=>new RegExp(`(?<![\\p{L}\\p{N}])${escape(s)}(?![\\p{L}\\p{N}])`,'giu');

// Pattern-based redaction is deliberately disclosed as incomplete. No remote
// recognizer, raw-text logging, persistent cache or document storage is used.
function redact(text:string,identifiers:string[]){
 let value=text.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'[email]')
  .replace(/(?:https?:\/\/|www\.)[^\s<>]+/gi,'[link]')
  .replace(/\+?\d[\d ()-]{7,}\d/g,'[phone]');
 for(const identifier of [...new Set(identifiers.map(x=>x.trim()).filter(Boolean))].sort((a,b)=>b.length-a.length)){
  const ranges=/\s/.test(identifier)?[]:catalogue.skills.flatMap(s=>[s.label,...s.aliases].flatMap(label=>[...value.matchAll(bounded(label))].map(m=>({start:m.index,end:m.index+m[0].length}))));
  value=value.replace(bounded(identifier),(match:string,offset:number)=>ranges.some(r=>offset>=r.start&&offset+match.length<=r.end)?match:'[removed]');
 }
 // Explicit organization/project fields and conventional named-entity forms.
 value=value.replace(/\b(company|employer|client|project)(?: name)?\s*:\s*[^.;\n]+/gi,'$1: [removed]')
  .replace(/\b[A-Z][\w&'-]*(?:\s+[A-Z][\w&'-]*){0,4}\s+(?:Ltd|Limited|Inc|LLC|Corporation|Corp|PLC)\b\.?/g,'[organization]')
  .replace(/\b(at|for|with)\s+(?:client\s+)?([A-Z][\w&'-]*(?:\s+[A-Z][\w&'-]*){0,3})(?=\s+(?:as|where|from|during|on|using|in)\b|[.,;]|$)/g,(match,prep,name)=>catalogue.skills.some(s=>[s.label,...s.aliases].some(term=>term.toLowerCase()===String(name).toLowerCase()))?match:`${prep} [organization]`)
  .replace(/\b(?:project|client|company)\s+["“][^"”\n]+["”]/gi,'[organization or project]');
 return value;
}

export function prepareCvText(raw:string,identifiers:string[]=[]):PreparedCv{
 let section:CvSection|'excluded'='uncertain';let uncertain=false;let excluded=false;
 let documentHeader=true;
 const blocks:CvBlock[]=[];let pending:string[]=[];
 const flush=()=>{if(pending.length&&section!=='excluded'){
  const text=redact(pending.join('\n'),identifiers).replace(/\s+/g,' ').trim();
  if(text){blocks.push({id:`cv-${blocks.length+1}`,section,text});if(section==='uncertain')uncertain=true;}
 }pending=[];};
 for(const rawLine of raw.split(/\r?\n/)){
  const line=rawLine.trim();
  if(!line){flush();continue;}
  const colon=line.indexOf(':');const title=(colon>=0?line.slice(0,colon):line).trim();
  const heading=headings.find(([pattern])=>pattern.test(title));
  if(heading){flush();section=heading[1];if(section==='excluded')excluded=true;else documentHeader=false;
   if(colon>=0&&section!=='excluded'&&line.slice(colon+1).trim())pending.push(line.slice(colon+1).trim());
   continue;
  }
  // Ambiguous combined headings do not inherit an earlier excluded section.
  if(/^(?:education\s*(?:and|&)\s*projects|career achievements|career overview)$/i.test(title)){
   flush();section='uncertain';uncertain=true;continue;
  }
  if(section==='excluded'){
   // Preserve a certification title as credential context while excluding the
   // surrounding degree, institution, date and coursework text.
   if(/\b(?:b\.?s\.?|bachelor|master|ph\.?d|degree|coursework|university|college)\b/i.test(line))continue;
   // Only explicitly identified credential lines may leave an excluded section.
   // Following lines can be names, locations or institutions, not credential context.
   if(/^(?:name|e-?mail|phone|mobile|address|location|city|date of birth|dob|nationality|marital status|linkedin)\s*:/i.test(line))continue;
   if(/\b(?:certified|certification|certificate|licensed)\b/i.test(line)){blocks.push({id:`cv-${blocks.length+1}`,section:'certifications',text:redact(line,identifiers).replace(/\s+/g,' ').trim()});continue;}
   continue;
  }
  if(/^(?:ignore\s+(?:all|previous|the)\b|(?:system|assistant)\s*:|invoke\s+(?:a|an|the|tool)\b)/i.test(line)){pending.push('[instruction omitted].');continue;}
  if(documentHeader&&/^[A-Z][\p{Ll}'’-]+(?:\s+[A-Z][\p{Ll}'’-]+){1,3}$/u.test(line))continue;
  if(/^(?:name|e-?mail|phone|mobile|address|location|city|date of birth|dob|nationality|marital status|linkedin)\s*:/i.test(line))continue;
  if(/^(?:https?:\/\/|www\.)/i.test(line)||/^[^\s@]+@[^\s@]+$/.test(line))continue;
  if(/^[\p{Lu}][\p{L}'’-]+(?:\s+[\p{Lu}][\p{L}'’-]+){0,2}\s*[—-]\s*.+\b(?:resume|curriculum vitae|single-page cv)\b/iu.test(line))continue;
  // Job headings often combine the learner's title, employer and location.
  const employerHeading=line.replace(/([—-])\s*[A-Z][\w&'.-]*(?:\s+[A-Z][\w&'.-]*){0,5}(?=\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b)/g,'$1 [organization]')
   .replace(/\s*\|\s*(?:[A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+)*,\s*[A-Z]{2}|Remote)\b.*$/iu,'')
   .replace(/\s*\|\s*(?:[^,|]+,\s*[A-Z]{2}|Remote)\s*$/,'');
  if(employerHeading!==line){pending.push(employerHeading);continue;}
  // Remove labeled personal details embedded in a retained contact line.
  const contactFree=line.replace(/(?:^|[•|]\s*)(?:email|e-mail|phone|mobile|linkedin|location|address|marital status)\s*:\s*[^•|]*/gi,' ').trim();
  if(!contactFree)continue;
  // A bullet is a source boundary, not an invitation to remove a negation.
  if(/^[•*-]\s+/.test(contactFree)){flush();pending.push(contactFree.replace(/^[•*-]\s+/,''));}
  else pending.push(contactFree);
 }
 flush();
 const warnings=['Detectable personal, company, client and project details were removed. Automatic redaction cannot guarantee anonymity.'];
 if(uncertain)warnings.push('Some sections could not be classified. Relevant redacted context was retained; review evidence carefully or use manual entry.');
 if(excluded)warnings.push('Education, personal or other excluded sections were omitted from AI processing.');
 return {text:blocks.map(b=>b.text).join('\n'),blocks,warnings};
}
