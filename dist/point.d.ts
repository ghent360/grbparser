import { ObjectMirroring } from "./primitives";
export declare class Point {
    x: number;
    y: number;
    constructor(x?: number, y?: number);
    isValid(): boolean;
    toString(): string;
    add(other: Point): Point;
    subtract(other: Point): Point;
    scale(scale: number): Point;
    mirror(mirror: ObjectMirroring): Point;
    distance1(other: Point): number;
    distance2(other: Point): number;
    distance(other: Point): number;
    clone(): Point;
    midPoint(other: Point): Point;
    angleFrom(other: Point): number;
    angleTo(other: Point): number;
    angle(): number;
}
