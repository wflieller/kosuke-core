import { Suspense } from 'react';

import { Login } from '../../../components/auth/LoginForm';

export default function SignInPage() {
  return (
    <Suspense>
      <Login mode="signin" />
    </Suspense>
  );
}
