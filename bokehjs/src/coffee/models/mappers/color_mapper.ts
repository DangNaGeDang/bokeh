/* XXX: partial */
import {Transform} from "../transforms/transform";
import * as p from "core/properties";
import {Arrayable, Color} from "core/types"
import {isNumber} from "core/util/types"

export namespace ColorMapper {
  export interface Attrs extends Transform.Attrs {
    palette: (number | string)[]
    nan_color: Color
  }

  export interface Props extends Transform.Props {}
}

export interface ColorMapper extends ColorMapper.Attrs {}

export abstract class ColorMapper extends Transform {

  properties: ColorMapper.Props

  constructor(attrs?: Partial<ColorMapper.Attrs>) {
    super(attrs)
  }

  static initClass(): void {
    this.prototype.type = "ColorMapper";

    this.define({
      palette:   [ p.Any           ], // TODO (bev)
      nan_color: [ p.Color, "gray" ],
    });
  }

  protected _little_endian: boolean
  protected _palette: number[]

  initialize(): void {
    super.initialize();
    this._little_endian = this._is_little_endian();
    this._palette       = this._build_palette(this.palette);
  }

  connect_signals(): void {
    super.connect_signals()
    this.connect(this.change, function() {
      this._palette = this._build_palette(this.palette);
    });
  }

  // TODO (bev) This should not be needed, everything should use v_compute
  v_map_screen(data, image_glyph: boolean = false) {
    const values = this._get_values(data, this._palette, image_glyph);
    const buf = new ArrayBuffer(data.length * 4);
    if (this._little_endian) {
      const color = new Uint8Array(buf);
      for (let i = 0, end = data.length; i < end; i++) {
        const value = values[i];
        const ind = i*4;
        // Bitwise math in JS is limited to 31-bits, to handle 32-bit value
        // this uses regular math to compute alpha instead (see issue #6755)
        color[ind] = Math.floor((value/4278190080.0) * 255);
        color[ind+1] = (value & 0xff0000) >> 16;
        color[ind+2] = (value & 0xff00) >> 8;
        color[ind+3] = value & 0xff;
      }
    } else {
      const color = new Uint32Array(buf);
      for (let i = 0, end = data.length; i < end; i++) {
        const value = values[i];
        color[i] = (value << 8) | 0xff;
      }     // alpha
    }
    return buf;
  }

  compute(_x: number): never {
    // If it's just a single value, then a color mapper doesn't
    // really make sense, so return nothing
    return null as never
  }

  v_compute(xs: Arrayable<number>): Arrayable<number> {
    return this._get_values(xs, this.palette) as any // XXX
  }

  abstract _get_values(data: number[] | string[], palette: number[], image_glyph?: boolean): number[]

  _is_little_endian() {
    const buf = new ArrayBuffer(4);
    const buf8 = new Uint8Array(buf);
    const buf32 = new Uint32Array(buf);
    buf32[1] = 0x0a0b0c0d;

    let little_endian = true;
    if ((buf8[4]===0x0a) && (buf8[5]===0x0b) && (buf8[6]===0x0c) && (buf8[7]===0x0d)) {
      little_endian = false;
    }
    return little_endian;
  }

  _build_palette(palette): number[] {
    const new_palette = new Uint32Array(palette.length);
    const _convert = function(value) {
      if (isNumber(value)) {
        return value;
      } else {
        if (value.length !== 9) {
          value = value + 'ff';
        }
        return parseInt(value.slice(1), 16);
      }
    };
    for (let i = 0, end = palette.length; i < end; i++) {
      new_palette[i] = _convert(palette[i]);
    }
    return new_palette;
  }
}
ColorMapper.initClass();
