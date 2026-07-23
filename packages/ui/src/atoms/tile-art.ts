import type { TileId } from "@riichimi/score-core";
import type { ComponentType } from "react";
import type { SvgProps } from "react-native-svg";

import Tile0M from "../../assets/tiles/0m.svg";
import Tile0P from "../../assets/tiles/0p.svg";
import Tile0S from "../../assets/tiles/0s.svg";
import Tile1M from "../../assets/tiles/1m.svg";
import Tile1P from "../../assets/tiles/1p.svg";
import Tile1S from "../../assets/tiles/1s.svg";
import Tile2M from "../../assets/tiles/2m.svg";
import Tile2P from "../../assets/tiles/2p.svg";
import Tile2S from "../../assets/tiles/2s.svg";
import Tile3M from "../../assets/tiles/3m.svg";
import Tile3P from "../../assets/tiles/3p.svg";
import Tile3S from "../../assets/tiles/3s.svg";
import Tile4M from "../../assets/tiles/4m.svg";
import Tile4P from "../../assets/tiles/4p.svg";
import Tile4S from "../../assets/tiles/4s.svg";
import Tile5M from "../../assets/tiles/5m.svg";
import Tile5P from "../../assets/tiles/5p.svg";
import Tile5S from "../../assets/tiles/5s.svg";
import Tile6M from "../../assets/tiles/6m.svg";
import Tile6P from "../../assets/tiles/6p.svg";
import Tile6S from "../../assets/tiles/6s.svg";
import Tile7M from "../../assets/tiles/7m.svg";
import Tile7P from "../../assets/tiles/7p.svg";
import Tile7S from "../../assets/tiles/7s.svg";
import Tile8M from "../../assets/tiles/8m.svg";
import Tile8P from "../../assets/tiles/8p.svg";
import Tile8S from "../../assets/tiles/8s.svg";
import Tile9M from "../../assets/tiles/9m.svg";
import Tile9P from "../../assets/tiles/9p.svg";
import Tile9S from "../../assets/tiles/9s.svg";
import TileEAST from "../../assets/tiles/east.svg";
import TileGREEN from "../../assets/tiles/green.svg";
import TileNORTH from "../../assets/tiles/north.svg";
import TileRED from "../../assets/tiles/red.svg";
import TileSOUTH from "../../assets/tiles/south.svg";
import TileWEST from "../../assets/tiles/west.svg";
import TileWHITE from "../../assets/tiles/white.svg";

/** Public-domain tile art from FluffyStuff/riichi-mahjong-tiles (CC0). */
export const tileArt: Record<TileId, ComponentType<SvgProps>> = {
  "0m": Tile0M,
  "0p": Tile0P,
  "0s": Tile0S,
  "1m": Tile1M,
  "1p": Tile1P,
  "1s": Tile1S,
  "2m": Tile2M,
  "2p": Tile2P,
  "2s": Tile2S,
  "3m": Tile3M,
  "3p": Tile3P,
  "3s": Tile3S,
  "4m": Tile4M,
  "4p": Tile4P,
  "4s": Tile4S,
  "5m": Tile5M,
  "5p": Tile5P,
  "5s": Tile5S,
  "6m": Tile6M,
  "6p": Tile6P,
  "6s": Tile6S,
  "7m": Tile7M,
  "7p": Tile7P,
  "7s": Tile7S,
  "8m": Tile8M,
  "8p": Tile8P,
  "8s": Tile8S,
  "9m": Tile9M,
  "9p": Tile9P,
  "9s": Tile9S,
  east: TileEAST,
  green: TileGREEN,
  north: TileNORTH,
  red: TileRED,
  south: TileSOUTH,
  west: TileWEST,
  white: TileWHITE,
};
