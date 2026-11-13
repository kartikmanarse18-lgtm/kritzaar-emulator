// Compatibility badge shared by the hub, catalog and game pages. Text is set with textContent.
export const COMPAT = {
  verified:  { label: 'Tested: works', hint: 'Played and checked on the browsers listed.' },
  playable:  { label: 'Works, with notes', hint: 'Runs, with small issues described in the notes.' },
  issues:    { label: 'Known issues', hint: 'Starts, but has problems that can stop you playing.' },
  broken:    { label: 'Not working', hint: 'Does not run in this player right now.' },
  untested:  { label: 'Not yet tested', hint: 'Nobody has tested this with the official file yet.' },
};
export function compatBadge(compat) {
  const c = compat && COMPAT[compat.status] ? compat : { status: 'untested' };
  const span = document.createElement('span');
  span.className = 'kz-compat kz-compat--' + c.status;
  span.textContent = COMPAT[c.status].label + (c.testedAt ? ' · ' + c.testedAt : '');
  span.title = COMPAT[c.status].hint + (c.notes ? ' ' + c.notes : '');
  return span;
}
