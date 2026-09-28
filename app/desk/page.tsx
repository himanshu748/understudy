import Link from 'next/link';
import {
  getChatGPTUser,
  chatGPTSignInPath,
  chatGPTSignOutPath,
} from '@/app/chatgpt-auth';
import DeskApp from './workspace';
export const dynamic = 'force-dynamic';
export default async function DeskPage() {
  const user = await getChatGPTUser();
  if (!user)
    return (
      <main className="signin-page">
        <Link className="brand" href="/">
          Understudy.
        </Link>
        <p className="eyebrow">YOUR PRIVATE WORKSPACE</p>
        <h1>
          A desk of
          <br />
          your own.
        </h1>
        <p>
          Sign in to add equipment, approve lending rules and keep a record of
          every loan. Your workspaces are visible only to your account.
        </p>
        <a className="button" href={chatGPTSignInPath('/desk')} target="_top">
          Sign in with ChatGPT ↗
        </a>
        <Link className="plain-link" href="/">
          Explore the example first
        </Link>
      </main>
    );
  return (
    <DeskApp
      displayName={user.displayName}
      signOutPath={chatGPTSignOutPath('/')}
    />
  );
}
