import { LinkForm } from '../components/LinkForm';

// PR2b rebuilds this screen to the handoff's 2-col grid (LinkForm +
// LinkResult + WhatYouGetCard). For PR2a this renders the existing
// unstyled form so the route is functional under the new shell.
export function CreateLinkPage() {
  return <LinkForm />;
}
