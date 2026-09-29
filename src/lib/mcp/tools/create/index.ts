import type { CreateArt } from "../write-schemas";
import { articleCreate } from "./article";
import type { CreateHandler } from "./common";
import { monsterCreate, universeCreate } from "./monster";
import { chapterCreate, questCreate } from "./quest";

export const CREATE_HANDLERS: Record<CreateArt, CreateHandler> = {
  artikel: articleCreate,
  quest: questCreate,
  kapitel: chapterCreate,
  monster: monsterCreate,
  universum: universeCreate,
};
