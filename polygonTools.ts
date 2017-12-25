/**
 * Gerber Parsing Library
 * 
 * Author: Venelin Efremov
 * Copyright: Copyright (c) Venelin Efremov 2017
 * 
 * License: MIT License, see LICENSE.txt
 */

/**
 * This file contains helper functions used to construct polygons from
 * various basic shapes.
 */
import {Point} from "./point";
import {Polygon} from "./polygonSet";

const PI2 = Math.PI * 2;
export const NUMSTEPS = 40;
const NUMSTEPS2 = NUMSTEPS / 2;

export function circleToPolygon(
    radius:number,
    nsteps:number = NUMSTEPS,
    rotation:number = 0):Polygon {
    let result:Polygon = new Float64Array(nsteps * 2 + 2);
    let step = PI2 / nsteps;
    rotation = (PI2 * rotation) / 360;
    for (let idx = 0; idx <= nsteps; idx++) {
        let dx = Math.cos(idx * step - rotation) * radius;
        let dy = Math.sin(idx * step - rotation) * radius;
        result[idx * 2] = dx;
        result[idx * 2 + 1] = dy;
    }
    return result;
}

export function rectangleToPolygon(width:number, height:number):Polygon {
    let width2 = width / 2;
    let height2 = height / 2;
    return Float64Array.of(
        width2, -height2,
        width2, height2,
        -width2, height2,
        -width2, -height2,
        width2, -height2);
}

export function obroundToPolygon(width:number, height:number):Polygon {
    let result:Polygon = new Float64Array((NUMSTEPS + 3) * 2);
    if (width < height) {
        let radius = width / 2;
        let innerHeight = height - width;
        let height2 = innerHeight / 2;
        result[0] = radius;
        result[1] = -height2;
        let step = Math.PI / NUMSTEPS2;
        for (let idx = 0; idx <= NUMSTEPS2; idx++) {
            let dx = Math.cos(idx * step) * radius;
            let dy = Math.sin(idx * step) * radius + height2;
            //result[idx + 1] = new Point(dx, dy);
            result[idx * 2 + 2] = dx;
            result[idx * 2 + 3] = dy;
        }
        for (let idx = 0; idx <= NUMSTEPS2; idx++) {
            let dx = Math.cos(idx * step + Math.PI) * radius;
            let dy = Math.sin(idx * step + Math.PI) * radius - height2;
            //result[idx + NUMSTEPS2 + 2] = new Point(dx, dy);
            result[idx * 2 + NUMSTEPS2 * 2 + 4] = dx;
            result[idx * 2 + NUMSTEPS2 * 2 + 5] = dy;
        }
    } else {
        let radius = height / 2;
        let innerWidth = width - height;
        let width2 = innerWidth / 2;
        result[0] = -width2;
        result[1] = -radius;
        let step = Math.PI / NUMSTEPS2;
        for (let idx = 0; idx <= NUMSTEPS2; idx++) {
            let dx = Math.sin(idx * step) * radius + width2;
            let dy = -Math.cos(idx * step) * radius;
            // result[idx + 1] = new Point(dx, dy);
            result[idx * 2 + 2] = dx;
            result[idx * 2 + 3] = dy;
        }
        for (let idx = 0; idx <= NUMSTEPS2; idx++) {
            let dx = -Math.sin(idx * step) * radius - width2;
            let dy = Math.cos(idx * step) * radius;
            // result[idx + NUMSTEPS2 + 2] = new Point(dx, dy);
            result[idx * 2 + NUMSTEPS2 * 2 + 4] = dx;
            result[idx * 2 + NUMSTEPS2 * 2 + 5] = dy;
        }
    }
    return result;
}

export function arcToPolygon(
    start:Point,
    end:Point,
    center:Point,
    closeEnd:boolean = true,
    closeStart:boolean = true):Polygon {
    let result:Polygon = new Float64Array(
        2 * (NUMSTEPS - ((closeStart) ? 0 : 1) - ((closeEnd) ? 0 : 1)));
    let startAngle = center.angleFrom(start);
    let endAngle = center.angleFrom(end);
    if (endAngle < startAngle) {
        endAngle += Math.PI * 2;
    }
    let radius = (center.distance(start) + center.distance(end)) / 2;
    let step = (endAngle - startAngle) / NUMSTEPS;
    let startOffset = -2;
    if (closeStart) {
        result[0] = start.x;
        result[1] = start.y;
        startOffset = 0;
    }
    for (let idx = 1; idx < NUMSTEPS; idx++) {
        let angle = idx * step + startAngle;
        let x = center.x + radius * Math.cos(angle);
        let y = center.y + radius * Math.sin(angle);
        result[idx * 2 + startOffset] = x;
        result[idx * 2 + startOffset + 1] = y;
    }
    if (closeEnd) {
        result[NUMSTEPS * 2 - 2 + startOffset] = end.x;
        result[NUMSTEPS * 2 - 1 + startOffset] = end.y;
    }
    return result;
}
