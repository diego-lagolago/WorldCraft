import type { UpdateArt } from "../write-schemas";
import { articleUpdate } from "./article";
import { chapterUpdate } from "./chapter";
import type { UpdateHandler } from "./common";
import { monsterUpdate } from "./monster";
import { noteUpdate } from "./note";
import { questUpdate } from "./quest";
import { universeUpdate } from "./universe";
import { worldUpdate } from "./world";

export const UPDATE_HANDLERS: Record<UpdateArt, UpdateHandler> = {
  artikel: articleUpdate,
  quest: questUpdate,
  kapitel: chapterUpdate,
  notizblock: noteUpdate,
  monster: monsterUpdate,
  universum: universeUpdate,
  welt: worldUpdate,
};
