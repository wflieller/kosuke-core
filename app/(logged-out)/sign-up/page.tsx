import { Suspense } from 'react';

import { Login } from '../../../components/auth/LoginForm';

export default function SignUpPage() {
  return (
    <Suspense>
      <Login mode="signup" />
    </Suspense>
  );
}
