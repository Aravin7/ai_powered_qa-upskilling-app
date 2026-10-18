import { requirementDraft } from '../src/lib/requirement-draft';
import { publicationReadyLibrary, requirementContentDigest, validateRequirementLibrary } from '../src/lib/requirements';
import { DomainError } from '../src/lib/domain';

// No publication or database mutation. Reviewer identity must be established
// outside this structural check; setting a JSON field is not review evidence.
try{
 const library=validateRequirementLibrary(requirementDraft);
 if(process.argv.includes('--reviewed'))publicationReadyLibrary(library);
 console.log(JSON.stringify({version:library.version,capabilities:library.capabilities.length,detailsComplete:library.capabilities.every(item=>item.scope&&item.effort),reviewed:library.review!==null,contentDigest:requirementContentDigest(library)}));
}catch(error){console.error(error instanceof DomainError?`${error.code}: ${error.message}`:error instanceof Error?error.message:'Requirement validation failed.');process.exitCode=1;}
