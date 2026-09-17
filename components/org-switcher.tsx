'use client';

import { useEffect, useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import type { Organization } from '@/lib/fut-types';
import { CURRENT_ORG_KEY, getCurrentOrg, listMyOrganizations, setCurrentOrg } from '@/lib/organizations';

export function OrgSwitcher({ onChange }: { onChange?: (slug: string) => void }) {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [current, setCurrent] = useState<string | null>(() => getCurrentOrg());

  useEffect(() => {
    if (!user) return;
    (async () => {
      const mine = await listMyOrganizations(user.uid);
      setOrgs(mine);
      if (!getCurrentOrg() && mine[0]) {
        setCurrentOrg(mine[0].slug || mine[0].id);
        setCurrent(mine[0].slug || mine[0].id);
      }
    })();
  }, [user]);

  if (!orgs.length) return null;

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Trocar de futebol"
        value={current ?? ''}
        onChange={(e) => {
          setCurrent(e.target.value);
          window.localStorage.setItem(CURRENT_ORG_KEY, e.target.value);
          onChange?.(e.target.value);
          window.location.assign(`/f/${e.target.value}`);
        }}
        className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-semibold"
      >
        {orgs.map((o) => (
          <option key={o.id} value={o.slug || o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <Button variant="ghost" size="lg" className="h-10 px-3" onClick={() => window.location.assign('/app')} aria-label="Ver meus futebóis">
        <ChevronsUpDown className="size-4" />
        Meus futebóis
      </Button>
    </div>
  );
}
