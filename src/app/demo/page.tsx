import { notFound } from 'next/navigation';
import { Workspace } from '@/components/workspace';
import { demoState } from '@/lib/domain';
export const dynamic='force-dynamic';
export default function Demo(){if(process.env.NODE_ENV==='production')notFound();return <Workspace mode="demo" initial={demoState()}/>;}
