import { describe, expect, it } from 'vitest';
import { resourceCandidates, resourceResearchPrompt, validateDiscoveredPair } from '../src/lib/resource-discovery';
import { groqResourceResearchRequest, parseGroqNativeResearch, type NativeResearchDiagnostic } from '../src/lib/groq-resource-research';
import { inspectResourcePages, publicNetworkAddress, verifiedResourceChecks } from '../src/lib/resource-page-verifier';

const context = { pathwayId: 'synthetic-qa-ci', pathwayTitle: 'QA automation with CI/CD', topicId: 'synthetic-ci', topicTitle: 'Run browser tests in CI' };
const results = [
  { sourceId: 'native-source-1', title: 'Synthetic CI documentation', url: 'https://docs.example.org/testing/ci', publisher: 'Synthetic Docs', kind: 'documentation' },
  { sourceId: 'native-source-2', title: 'Synthetic CI lesson', url: 'https://courses.example.org/lessons/browser-ci', publisher: 'Synthetic Lessons', kind: 'tutorial' },
];
const now = new Date('2026-10-17T09:00:00.000Z');
const sources = results.map(result => ({ id: result.sourceId, url: result.url }));
const candidates = resourceCandidates(results, sources);
const selection = { documentationId: candidates[0].id, supportingId: candidates[1].id };
const checks = candidates.map(candidate => ({ candidateId: candidate.id, url: candidate.url, topicId: context.topicId, available: true, topicRelevant: true, officialDocumentation: candidate.kind === 'documentation', detectedKind: candidate.kind, accessNote: 'Synthetic free lesson; no account.', checkedAt: now.toISOString() }));

describe('US15 / dynamic resource contracts - synthetic search and verification only, no network or live AI', () => {
  it.each(['browser.open','browser.find'])('RS-25: accepts observed native %s navigation with source-bound candidates',action=>{
    const content=JSON.stringify({results:results.map(({url,kind})=>({url,kind}))});
    const executed_tools=[{type:'browser_search',index:0,search_results:{results:[{url:results[0].url,title:results[0].title}]}},
      {type:action,index:1,browser_results:[{url:results[1].url,title:results[1].title}]}];
    const parsed=parseGroqNativeResearch({content,executed_tools},6,'synthetic-open-action');
    expect(parsed.results.map(item=>item.url)).toEqual(results.map(item=>item.url));
    expect(parsed.sources[1].citation).toMatchObject({toolIndex:1,resultType:'browser'});
    expect(()=>parseGroqNativeResearch({content,executed_tools:[executed_tools[0],{...executed_tools[1],type:'code_interpreter'}]},6,'synthetic-open-action')).toThrow();
    expect(()=>parseGroqNativeResearch({content,executed_tools:[executed_tools[0],{type:'browser.open',index:1}]},6,'synthetic-open-action')).toThrow(/native browser tool/);
    expect(()=>parseGroqNativeResearch({content,executed_tools},1,'synthetic-open-action')).toThrow(expect.objectContaining({code:'RESOURCE_TOOL_LIMIT'}));
  });
  it('RS-26: metadata diagnostics expose field/type categories without untrusted values',()=>{
    const events:NativeResearchDiagnostic[]=[];
    const privateMarker='private-untrusted-value';
    expect(()=>parseGroqNativeResearch({content:'{}',executed_tools:[{type:privateMarker,index:0,browser_results:null}]},6,'synthetic-diagnostic',event=>events.push(event))).toThrow();
    expect(events[0].issues).toEqual([
      {field:'executed_tools.*.type',code:'invalid_value',receivedType:'string',toolType:'unrecognized'},
      {field:'executed_tools.*.browser_results',code:'invalid_type',receivedType:'null'},
    ]);
    expect(JSON.stringify(events)).not.toContain(privateMarker);
  });
  it.each([4,5,6,7])('RS-24: six-action allowance handles %i native browser actions', count => {
    const content=JSON.stringify({results:results.map(({url,kind})=>({url,kind}))});
    const executed_tools=Array.from({length:count},(_,index)=>({type:'browser_search',index,browser_results:results.map(({url,title})=>({url,title}))}));
    const parse=()=>parseGroqNativeResearch({content,executed_tools},6,'synthetic-six-action-limit');
    if(count<=6)expect(parse().results).toHaveLength(2);
    else expect(parse).toThrow(expect.objectContaining({code:'RESOURCE_TOOL_LIMIT'}));
  });
  it.each([1,2,3])('RS-23 / US15: accepts counts within two and explicitly rejects %i executions above it', count => {
    const content=JSON.stringify({results:results.map(({url,kind})=>({url,kind}))});
    const executed_tools=Array.from({length:count},(_,index)=>({type:'browser_search',index,browser_results:results.map(({url,title})=>({url,title}))}));
    const events:NativeResearchDiagnostic[]=[];
    const parse=()=>parseGroqNativeResearch({content,executed_tools},2,'synthetic-limit-check',event=>events.push(event));
    if(count<=2){expect(parse().results).toHaveLength(2);expect(events[0].outcome).toBe('accepted');}
    else{expect(parse).toThrow(expect.objectContaining({code:'RESOURCE_TOOL_LIMIT'}));expect(events).toEqual([{stage:'native_metadata',outcome:'rejected',toolCount:3}]);}
  });
  it('RS-01: uses the selected direction/topic and accepts new publishers outside the old catalogue', () => {
    const request = groqResourceResearchRequest(context);
    expect(JSON.parse(request.messages[1].content)).toEqual(context);
    expect(request.tools).toEqual([{ type: 'browser_search' }]);
    expect(request.tool_choice).toBe('required');
    expect(request).not.toHaveProperty('response_format');
    expect(request).not.toHaveProperty('citation_options');
    expect(request.messages[0].content).toContain('Use at most 6 native browser tool executions');
    expect(request.messages[0].content).toContain('Do not open additional pages in this search stage');
    expect(groqResourceResearchRequest(context,3).messages[0].content).toContain('Use at most 3 native browser tool executions');
    expect(()=>groqResourceResearchRequest(context,0)).toThrow();
    expect(()=>groqResourceResearchRequest(context,7)).toThrow();
    const pair = validateDiscoveredPair(context, results, selection, checks, sources, now);
    expect(pair.resources.map(resource => resource.url)).toEqual(results.map(result => result.url));
    expect(pair.resources.every(resource => resource.reviewStatus === 'automatically_checked')).toBe(true);
    expect(pair.professionalReview).toBeNull();
  });
  it('RS-02: rejects raw-CV/contact fields in the search context', () => {
    expect(() => resourceResearchPrompt({ ...context, cvText: 'synthetic private text', email: 'synthetic@example.org' })).toThrow();
  });
  it('RS-03: rejects model-invented IDs and URL fields rather than accepting hallucinated resources', () => {
    expect(() => validateDiscoveredPair(context, results, { ...selection, supportingId: 'invented' }, checks, sources, now)).toThrow(/returned by search/);
    expect(() => validateDiscoveredPair(context, results, { ...selection, url: 'https://invented.example.org' }, checks, sources, now)).toThrow();
  });
  it('RS-04: requires a distinct documentation page and supporting material', () => {
    expect(() => validateDiscoveredPair(context, results, { ...selection, supportingId: selection.documentationId }, checks, sources, now)).toThrow();
    expect(() => validateDiscoveredPair(context, results, { documentationId: selection.supportingId, supportingId: selection.documentationId }, checks, sources, now)).toThrow();
  });
  it.each(['http://docs.example.org/ci', 'https://127.0.0.1/ci', 'https://[::1]/ci', 'https://localhost/ci', 'https://metadata.internal/ci', 'https://user:secret@docs.example.org/ci', 'https://docs.example.org:8443/ci'])('RS-05: screens unsupported URL %s without fetching it', url => {
    expect(() => resourceCandidates([{ ...results[0], url }], [{ id: results[0].sourceId, url }])).toThrow(/unsupported resource URL/);
  });
  it('RS-06: rejects duplicate pages disguised with different fragments', () => {
    const duplicates = [results[0], { ...results[1], url: `${results[0].url}#another-section` }];
    expect(() => resourceCandidates(duplicates, duplicates.map(result => ({ id: result.sourceId, url: result.url })))).toThrow(/duplicate/);
  });
  it.each([
    { available: false }, { topicRelevant: false }, { topicId: 'different-topic' },
    { url: 'https://unrelated.example.org/page' }, { detectedKind: 'documentation' },
    { checkedAt: '2026-10-17T08:59:14.999Z' }, { checkedAt: '2026-10-17T09:00:00.001Z' },
  ])('RS-07: fails the whole pair for unavailable, irrelevant, unbound or stale checks %#', change => {
    expect(() => validateDiscoveredPair(context, results, selection, [checks[0], { ...checks[1], ...change }], sources, now)).toThrow();
  });
  it('RS-10: a documentation label alone cannot establish official documentation', () => {
    expect(() => validateDiscoveredPair(context, results, selection, [{ ...checks[0], officialDocumentation: false }, checks[1]], sources, now)).toThrow();
  });
  it('RS-08: rejects duplicate verification evidence', () => {
    expect(() => validateDiscoveredPair(context, results, selection, [checks[0], checks[0]], sources, now)).toThrow();
  });
  it('RS-09: rejects oversized search output instead of silently truncating it', () => {
    expect(() => resourceCandidates(Array.from({ length: 21 }, (_, index) => ({ ...results[0], url: `https://docs.example.org/ci/${index}` })), sources)).toThrow();
  });
  it('RS-11: rejects missing native-tool sources rather than trusting model citations', () => {
    expect(() => resourceCandidates(results, [])).toThrow(/native research tool/);
  });
  it('RS-12: rejects a source ID used for a different URL', () => {
    expect(() => resourceCandidates([{ ...results[0], url: 'https://invented.example.org/page' }], sources)).toThrow(/native research tool/);
  });
  it('RS-13: native source parsing ignores model titles and rejects prose-only citations, forged URLs and extra tools',()=>{
    const native={type:'browser_search',arguments:'{}',index:0,search_results:{results:results.map(item=>({title:item.title,url:item.url,content:'Synthetic CI source text'}))}};
    const content=JSON.stringify({results:results.map(({url,kind})=>({url,kind}))});
    const parsed=parseGroqNativeResearch({content,executed_tools:[native]},2,'synthetic-request');
    expect(parsed.results.map(item=>item.title)).toEqual(results.map(item=>item.title));
    expect(parsed.sources[0].citation).toMatchObject({requestId:'synthetic-request',toolIndex:0,resultType:'search',resultIndex:0});
    expect(()=>parseGroqNativeResearch({content},2,'synthetic-request')).toThrow();
    expect(()=>parseGroqNativeResearch({content,executed_tools:[{...native,type:'code_interpreter'}]},2,'synthetic-request')).toThrow();
    expect(()=>parseGroqNativeResearch({content,executed_tools:[native,native]},1,'synthetic-request')).toThrow();
    expect(()=>parseGroqNativeResearch({content:JSON.stringify({results:[{url:'https://invented.example.org/ci',kind:'documentation'},...results.slice(1).map(({url,kind})=>({url,kind}))]}),executed_tools:[native]},2,'synthetic-request')).toThrow(/native browser tool/);
  });
  it('RS-14: independently inspected topic excerpts and reviewed official hosts bind the selected pair',async()=>{
    const scope={...context,officialDocumentationHosts:['docs.example.org'],topicTerms:['browser tests']};
    const text='Run browser tests in CI using stable expectations and isolated synthetic data.';
    const addresses:string[]=[];
    const pages=await inspectResourcePages(scope,candidates,new AbortController().signal,{resolve:async()=>[{address:'93.184.215.14',family:4}],read:async(_url,address)=>{addresses.push(address.address);return {status:200,headers:{'content-type':'text/html'},body:`<main><p>${text}</p></main>`};}});
    const picked={...selection,evidence:candidates.map(candidate=>({candidateId:candidate.id,topicExcerpt:text,access:'public-page',accessExcerpt:''}))};
    const checked=verifiedResourceChecks(scope,candidates,pages,picked);
    const pair=validateDiscoveredPair(scope,results,selection,checked,sources);
    expect(addresses).toEqual(['93.184.215.14','93.184.215.14']);expect(pair.resources).toHaveLength(2);
    expect(JSON.stringify(pair)).not.toContain(text);
    expect(()=>verifiedResourceChecks({...scope,officialDocumentationHosts:['other.example.org']},candidates,pages,picked)).toThrow();
    expect(()=>verifiedResourceChecks(scope,candidates,pages,{...picked,evidence:[{...picked.evidence[0],topicExcerpt:'Invented browser tests evidence not on the page.'},picked.evidence[1]]})).toThrow();
  });
  it('RS-15: rejects private/mixed DNS and redirects before making an unsafe connection',async()=>{
    let calls=0;
    await expect(inspectResourcePages(context,candidates,new AbortController().signal,{resolve:async()=>[{address:'93.184.215.14',family:4},{address:'127.0.0.1',family:4}],read:async()=>{calls++;throw new Error('unsafe');}})).rejects.toThrow();
    expect(calls).toBe(0);
    const hosts:string[]=[];
    await expect(inspectResourcePages(context,candidates,new AbortController().signal,{resolve:async host=>{hosts.push(host);return [{address:host==='private.example.org'?'10.0.0.1':'93.184.215.14',family:4}];},read:async()=>{calls++;return {status:302,headers:{location:'https://private.example.org/ci'},body:''};}})).rejects.toThrow();
    expect(hosts).toContain('private.example.org');expect(calls).toBeLessThanOrEqual(2);
  });
  it.each(['127.0.0.1','10.1.2.3','169.254.169.254','100.64.0.1','192.168.1.2','198.18.0.1','::1','::ffff:127.0.0.1','fc00::1','fe80::1','2001:db8::1','2002:7f00:1::'])('RS-16: rejects non-global address %s',address=>{expect(publicNetworkAddress(address)).toBe(false);});
  it('RS-17: allows global addresses while rejecting inaccessible pages and cancelled inspection',async()=>{
    expect(publicNetworkAddress('93.184.215.14')).toBe(true);expect(publicNetworkAddress('2606:4700:4700::1111')).toBe(true);expect(publicNetworkAddress('2001:4860:4860::8888')).toBe(true);
    await expect(inspectResourcePages(context,candidates,new AbortController().signal,{resolve:async()=>[{address:'93.184.215.14',family:4}],read:async()=>({status:403,headers:{'content-type':'text/html'},body:'Sign in'})})).rejects.toThrow();
    const controller=new AbortController();controller.abort();let reads=0;
    await expect(inspectResourcePages(context,candidates,controller.signal,{resolve:async()=>[{address:'93.184.215.14',family:4}],read:async()=>{reads++;throw new Error('cancelled');}})).rejects.toThrow();expect(reads).toBe(0);
  });
  it('RS-18: retains access and prerequisite conditions outside topic sentences and the main article',async()=>{
    const scope={...context,officialDocumentationHosts:['docs.example.org'],topicTerms:['browser tests']};
    const topic='Run browser tests in CI with isolated data and stable assertions.';
    const access='Sign in and a paid subscription are required.';
    const prerequisite='Prerequisites: install Node version 24 and Git.';
    const pages=await inspectResourcePages(scope,candidates,new AbortController().signal,{resolve:async()=>[{address:'93.184.215.14',family:4}],read:async()=>({status:200,headers:{'content-type':'text/html'},body:`<header>${access}</header><main>${topic} ${prerequisite}</main>`})});
    expect(pages.every(page=>page.text.includes(access)&&page.text.includes(prerequisite))).toBe(true);
    const checked=verifiedResourceChecks(scope,candidates,pages,{...selection,evidence:candidates.map(candidate=>({candidateId:candidate.id,topicExcerpt:topic,access:'payment',accessExcerpt:access}))});
    expect(checked.every(check=>check.accessNote.includes(access)&&check.accessNote.includes('Node version 24')&&check.accessNote.includes('not professionally reviewed'))).toBe(true);
    expect(()=>validateDiscoveredPair(scope,results,selection,checked,sources)).not.toThrow();
    const unsupported={...selection,evidence:candidates.map(candidate=>({candidateId:candidate.id,topicExcerpt:topic,access:'payment',accessExcerpt:topic}))};
    expect(()=>verifiedResourceChecks(scope,candidates,pages,unsupported)).toThrow();
    const freePages=pages.map(page=>({...page,text:`${topic} No payment is required.`}));
    expect(()=>verifiedResourceChecks(scope,candidates,freePages,{...selection,evidence:candidates.map(candidate=>({candidateId:candidate.id,topicExcerpt:topic,access:'payment',accessExcerpt:'No payment is required.'}))})).toThrow();
  });
  it('RS-19: one failed extra candidate does not discard an inspected documentation/tutorial pair',async()=>{
    const extra=resourceCandidates([{sourceId:'extra',url:'https://broken.example.org/topic',title:'Unavailable extra lesson',publisher:'Synthetic',kind:'video'}],[{id:'extra',url:'https://broken.example.org/topic'}]);
    const pages=await inspectResourcePages(context,[...candidates,...extra],new AbortController().signal,{resolve:async()=>[{address:'93.184.215.14',family:4}],read:async url=>({status:url.hostname==='broken.example.org'?403:200,headers:{'content-type':'text/html'},body:'Run browser tests in CI using isolated synthetic data and assertions.'})});
    expect(pages.map(page=>page.candidateId)).toEqual(candidates.map(candidate=>candidate.id));
  });
  it('RS-20: a single overlapping word or substring cannot verify the topic',async()=>{
    const scope={...context,topicTerms:['browser tests']};
    await expect(inspectResourcePages(scope,candidates,new AbortController().signal,{resolve:async()=>[{address:'93.184.215.14',family:4}],read:async()=>({status:200,headers:{'content-type':'text/html'},body:'Configure your browser settings and bookmarks for everyday browsing.'})})).rejects.toThrow();
    const pages=candidates.map(candidate=>({candidateId:candidate.id,url:candidate.url,finalUrl:candidate.url,text:'Configure browser settings and bookmarks for everyday browsing.',checkedAt:new Date().toISOString(),partial:false}));
    expect(()=>verifiedResourceChecks(scope,candidates,pages,{...selection,evidence:candidates.map(candidate=>({candidateId:candidate.id,topicExcerpt:pages[0].text,access:'unclear',accessExcerpt:''}))})).toThrow();
  });
  it.each(['native_metadata','research_json','candidate_schema','source_binding','resource_urls'] as const)('RS-21-%s: reports a controlled rejection stage without source/model content',stage=>{
    const privateMarker='synthetic-private-marker-do-not-log';
    const native={type:'browser_search',index:0,browser_results:results.map(item=>({url:item.url,title:privateMarker}))};
    const proposed={results:results.map(({url,kind})=>({url,kind}))};
    let message:unknown={content:JSON.stringify(proposed),executed_tools:[native]};
    if(stage==='native_metadata')message={content:JSON.stringify(proposed),privateMarker};
    if(stage==='research_json')message={content:privateMarker,executed_tools:[native]};
    if(stage==='candidate_schema')message={content:JSON.stringify({...proposed,privateMarker}),executed_tools:[native]};
    if(stage==='source_binding')message={content:JSON.stringify({results:[{...proposed.results[0],url:'https://invented.example.org/topic'},proposed.results[1]]}),executed_tools:[native]};
    if(stage==='resource_urls'){
      const unsafe='https://127.0.0.1/private';
      message={content:JSON.stringify({results:[{...proposed.results[0],url:unsafe},proposed.results[1]]}),executed_tools:[{...native,browser_results:[{url:unsafe,title:privateMarker},native.browser_results[1]]}]};
    }
    const events:NativeResearchDiagnostic[]=[];
    expect(()=>parseGroqNativeResearch(message,2,'synthetic-request',event=>events.push(event))).toThrow();
    expect(events).toMatchObject([{stage,outcome:'rejected',toolCount:stage==='native_metadata'?null:1}]);
    expect(JSON.stringify(events)).not.toMatch(/synthetic-private-marker|https?:|content|title/);
  });
  it('RS-22: diagnostic observer exceptions cannot change accepted research',()=>{
    const message={content:JSON.stringify({results:results.map(({url,kind})=>({url,kind}))}),executed_tools:[{type:'browser_search',index:0,browser_results:results.map(item=>({url:item.url,title:item.title}))}]};
    const parsed=parseGroqNativeResearch(message,2,'synthetic-request',()=>{throw new Error('Synthetic failed observer');});
    expect(parsed.results.map(item=>item.url)).toEqual(results.map(item=>item.url));
  });
});
