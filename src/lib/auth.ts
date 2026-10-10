import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { db } from './db';
import { admitGoogle, endSession } from './store';
export const authOptions: NextAuthOptions = {
 secret: process.env.NEXTAUTH_SECRET,
 providers: [GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID || '', clientSecret: process.env.GOOGLE_CLIENT_SECRET || '', authorization: { params: { scope: 'openid email profile', prompt: 'select_account' } }, checks: ['pkce', 'state', 'nonce'] })],
 session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
 pages: { signIn: '/', error: '/' },
 events: {async signOut({token}){if(typeof token?.uid==='string'&&typeof token.email==='string'&&typeof token.sessionVersion==='number')await endSession(db(),{id:token.uid,email:token.email,sessionVersion:token.sessionVersion});}},
 callbacks: {
  async signIn({ account, profile, user }) {
   if (account?.provider !== 'google' || !profile || !('email_verified' in profile) || profile.email_verified !== true || !profile.email || !profile.sub) return false;
   // Real participant admission remains closed until content and privacy gates are met.
   if (process.env.NODE_ENV === 'production' || process.env.ENABLE_SYNTHETIC_PILOT !== 'true') return false;
   try {
    const admitted = await admitGoogle(db(), profile.sub, profile.email, profile.name || 'Learner');
    user.id = admitted.id;
    user.sessionVersion = admitted.sessionVersion;
    user.email = admitted.email;
    return true;
   } catch { return false; }
  },
  async jwt({ token, user }) {
   if (user) { token.uid = user.id; token.sessionVersion = user.sessionVersion; token.email = user.email; }
   return token;
  },
  async session({ session, token }) {
   if (session.user) { session.user.id = typeof token.uid === 'string' ? token.uid : ''; session.user.sessionVersion = typeof token.sessionVersion === 'number' ? token.sessionVersion : -1; }
   return session;
  }
 },
 // Auth errors must not serialize OAuth profiles, tokens or callback query strings.
 logger: { error() {}, warn() {}, debug() {} },
 debug: false
};
