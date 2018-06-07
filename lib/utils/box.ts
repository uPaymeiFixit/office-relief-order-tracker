export class Point {
  constructor(public x: number, public y: number) {}
}

export class Box extends Point {
  constructor(
    public x: number,
    public y: number,
    public w: number,
    public h: number,
  ) {
    super(x, y);
  }
}

export function box_contains_point(box: Box, point: Point): boolean {
  return (
    box.x <= point.x &&
    box.y <= point.y &&
    box.x + box.w >= point.x &&
    box.y + box.h >= point.y
  );
}

export function offset_box(box: Box, offset: number): Box {
  return new Box(
    box.x - offset,
    box.y - offset,
    box.w + offset * 2,
    box.h + offset * 2,
  );
}
