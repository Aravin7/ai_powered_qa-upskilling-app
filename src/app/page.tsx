import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { ArrowUpRight, Route, ShieldCheck, Sparkles, Check } from 'lucide-react';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { getState } from '@/lib/store';
import { Workspace } from '@/components/workspace';
import type { AppState } from '@/lib/types';
import { LoginButton } from '@/components/login-button';
export const dynamic='force-dynamic';
export default async function Page(){
 const session=await getServerSession(authOptions);
 let initial:AppState|null=null;
 if(session?.user.id&&session.user.email){try{
  initial=await getState(db(),{id:session.user.id,email:session.user.email,sessionVersion:session.user.sessionVersion});
 }catch{/* Access failure never displays cached private state. */}}
 if(initial)return <Workspace mode="live" initial={initial}/>;
 return <main className="landing">
  <header className="landing-header"><Link className="brand" href="/"><span className="brand-icon"><Route size={25}/></span>QA Pathway</Link><span className="pill">INVITATION-ONLY PILOT</span></header>
  <div className="landing-grid"><section><span className="eyebrow">YOUR EXPERIENCE. YOUR NEXT CHAPTER.</span><h1>Build on what<br/>you already know.</h1><p className="landing-copy">A focused path from quality assurance to AI-assisted testing. Bring your experience, see what’s next, and make room to learn.</p><div className="landing-actions"><LoginButton/>{process.env.NODE_ENV!=='production'&&<Link className="button secondary" href="/demo">Explore synthetic demo <ArrowUpRight size={16}/></Link>}</div><p className="small muted">Use your invited Google account. Participant admission is closed while content and privacy settings are finalized.</p></section>
  <section className="landing-preview"><div className="icon-box"><Sparkles/></div><span className="eyebrow">A CLEARER WAY FORWARD</span><h2>Experience becomes<br/>your starting point.</h2>{[['01','Confirm your skills','Keep your experience at the center.'],['02','See your learning priorities','Compare against one focused pathway.'],['03','Learn at your pace','A plan that respects your available time.']].map(([n,t,d])=><div className="preview-step" key={n}><span>{n}</span><div><strong>{t}</strong><p>{d}</p></div><Check size={17}/></div>)}<footer><ShieldCheck size={16}/> Optional CV. Manual entry always available.</footer></section></div>
  <footer className="landing-footer">QA → AI-assisted testing <span>Learning activity is not a certification of competence.</span></footer>
 </main>;
}
