import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'QA Pathway · Learn with direction',description:'A focused learning workspace for experienced QA professionals exploring AI-assisted testing.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
