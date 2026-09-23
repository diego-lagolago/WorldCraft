import { MyWorldCharactersCard, WorldCharactersCard } from "@/components/characters/WorldCharacterCards";
import { SignOutButton } from "@/components/shell/SignOutButton";
import { InvitesCard } from "@/components/world/InvitesCard";
import { LeaveWorldButton } from "@/components/world/LeaveWorldButton";
import { MembersCard } from "@/components/world/MembersCard";
import { WorldSettingsCard } from "@/components/world/WorldSettingsCard";
import { isGm } from "@/lib/authz/types";
import { listMyCharacters, listWorldCharacters } from "@/lib/domain/characters";
import { listInvites } from "@/lib/domain/invites";
import { listMembers } from "@/lib/domain/members";
import { getWorldDetails } from "@/lib/domain/worlds";
import { asRichDoc } from "@/lib/editor/rich-text";
import { requireWorldPage } from "@/lib/page-context";

export default async function WorldMenuPage({ params }: PageProps<"/w/[worldId]">) {
  const { worldId } = await params;
  const { world, membership, user } = await requireWorldPage(worldId);
  const gm = isGm(membership.role);
  const [members, invites, details, characters, mine] = await Promise.all([
    listMembers(world.id),
    gm ? listInvites(membership) : null,
    gm ? getWorldDetails(world.id) : null,
    listWorldCharacters(world.id),
    listMyCharacters(user.id),
  ]);

  return (
    <>
      <h1 style={{ fontSize: 24, marginBottom: 14 }}>Menü</h1>
      <div className="grid2">
        <div className="stack">
          <WorldCharactersCard worldId={world.id} characters={characters} />
          <MyWorldCharactersCard worldId={world.id} mine={mine} />
          <MembersCard worldId={world.id} members={members} currentUserId={user.id} canManage={gm} />
          {invites?.ok ? <InvitesCard worldId={world.id} invites={invites.data} /> : null}
          {details ? (
            <WorldSettingsCard
              world={{
                id: details.id,
                name: details.name,
                description: asRichDoc(details.descriptionJson),
                titleImageId: details.titleImageId,
              }}
            />
          ) : null}
        </div>
        <div className="stack">
          <div className="card list">
            {gm ? null : <LeaveWorldButton worldId={world.id} worldName={world.name} />}
            <div className="item">
              <div className="grow small muted">Angemeldet als {user.name}</div>
            </div>
          </div>
          <SignOutButton />
        </div>
      </div>
    </>
  );
}
