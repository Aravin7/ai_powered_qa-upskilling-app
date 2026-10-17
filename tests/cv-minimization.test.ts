import { expect, it } from 'vitest';
import { minimizeText, validateExtraction } from '../src/lib/ai-output';
import { prepareCvText } from '../src/lib/cv-text';
import { readPdfUpload } from '../src/lib/pdf';
import { providerRequest } from '../src/lib/ai-provider-request';

it('CV-SEC-05 rejects a non-PDF MIME upload before provider processing',async()=>{
 const form=new FormData();form.set('file',new File(['%PDF-synthetic'],'synthetic.pdf',{type:'text/plain'}));form.set('operationKey',crypto.randomUUID());
 await expect(readPdfUpload(new Request('http://localhost/api/cv/extract',{method:'POST',body:form}))).rejects.toMatchObject({code:'PDF_UNSUPPORTED'});
});

it('CV-SEC-01 retains summary, work and technology lists while excluding personal/education/extra sections',()=>{
 const cv=prepareCvText('Personal Information\nName: Synthetic Person\nProfessional Summary\nExperienced in API testing.\nWork Experience\nI authored test cases.\nTechnologies\nPlaywright, TypeScript\nEducation\nI used prompt engineering.\nExtracurricular Activities\nI configured CI/CD.');
 expect(cv.text).toContain('Experienced in API testing');expect(cv.text).toContain('Playwright, TypeScript');
 expect(cv.text).not.toMatch(/Synthetic Person|prompt engineering|CI\/CD/);
 const request=JSON.parse(providerRequest({kind:'cv_extraction',text:cv.text,blocks:cv.blocks}).user);
 expect(request.sourceBlocks).toEqual(cv.blocks);expect(request).not.toHaveProperty('minimizedCvText');
 expect(JSON.stringify(request.sourceBlocks)).not.toMatch(/Synthetic Person|prompt engineering|CI\/CD/);
 const block=cv.blocks.find(b=>b.section==='technologies')!;
 const result=validateExtraction({skills:[{skillId:'automation',label:'Test automation',evidenceExcerpt:'Playwright',sourceId:block.id}]},cv.text,cv.blocks);
 expect(result[0].evidenceType).toBe('listed');
});
it('CV-SEC-02 preserves long wrapped negation, quoted context and rejects fabricated/misbound evidence',()=>{
 const cv=prepareCvText('Work Experience\nI have never '+ 'personally '.repeat(45)+'\nperformed API testing.');
 const candidate={skillId:'api-testing',label:'API testing',evidenceExcerpt:'performed API testing.',sourceId:cv.blocks[0].id};
 expect(()=>validateExtraction({skills:[candidate]},cv.text,cv.blocks)).toThrow();
 expect(()=>validateExtraction({skills:[{...candidate,sourceId:'cv-999'}]},cv.text,cv.blocks)).toThrow();
 const quoted=prepareCvText('Work Experience\n"Example only. I used Playwright. This is a quotation."');
 expect(()=>validateExtraction({skills:[{skillId:'automation',label:'Test automation',evidenceExcerpt:'I used Playwright.'}]},quoted.text,quoted.blocks)).toThrow();
});
it('CV-SEC-03 redacts embedded identifiers without discarding contact-form testing evidence',()=>{
 const cv=prepareCvText('Work Experience\nSynthetic Person tested the contact form at https://example.invalid for Nimbus Ltd.\nI performed API testing for Acme using Postman.\nClient: Confidential Customer\nProject: Secret Portal\nI authored test cases for account flows.',['Synthetic Person']);
 expect(cv.text).toContain('tested the contact form');expect(cv.text).toContain('API testing');
 expect(cv.text).not.toMatch(/Synthetic Person|https:|Nimbus|Acme|Confidential Customer|Secret Portal/);
 expect(cv.text).toContain('I authored test cases for account flows.');
});
it('CV-SEC-04 preserves uncertain mixed context with a warning and rejects non-testing negative wording',()=>{
 const cv=prepareCvText('Education\nExcluded study details\nEducation and Projects\nI reviewed negative customer feedback.');
 expect(cv.warnings.join(' ')).toContain('could not be classified');
 expect(cv.text).not.toContain('Excluded study');
 expect(()=>validateExtraction({skills:[{skillId:'test-design',label:'Test design',evidenceExcerpt:'I reviewed negative customer feedback.'}]},cv.text,cv.blocks)).toThrow();
});

it('CV-SEC-06 rejects an excerpt repeated in conflicting contexts instead of choosing the positive occurrence',()=>{
 const cv=prepareCvText('Work Experience\nI used Playwright. A quoted claim says I used Playwright.');
 expect(()=>validateExtraction({skills:[{skillId:'automation',label:'Test automation',evidenceExcerpt:'I used Playwright.'}]},cv.text,cv.blocks)).toThrow();
});

it('CV-10b / R04 / T04: removing a learner name does not erase an unrelated API skill acronym', () => {
  const text = minimizeText('I performed API testing on a synthetic local service.', ['Synthetic API Learner', 'Synthetic', 'API', 'Learner']);
  expect(text).toContain('API testing');
});

it('CV-10c / R04 / T04: full identity and separate name tokens are removed without matching inside words', () => {
  const text = minimizeText('Synthetic API Learner performed API testing.\nsynthetic performed testing.\nI used syntheticity tooling.', ['Synthetic API Learner', 'Synthetic', 'API', 'Learner']);
  expect(text).toContain('[removed] performed API testing');
  expect(text).toContain('[removed] performed testing');
  expect(text).not.toMatch(/synthetic performed|learner/i);
  expect(text).toContain('syntheticity tooling');
});
