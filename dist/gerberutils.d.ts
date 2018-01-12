export declare enum BoardLayer {
    Silk = 0,
    Copper = 1,
    Paste = 2,
    SolderMask = 3,
    Carbon = 4,
    Drill = 5,
    Outline = 6,
    Mill = 7,
    Unknown = 8,
    Notes = 9,
    Assembly = 10,
    Mechanical = 11,
}
export declare enum BoardSide {
    Top = 0,
    Bottom = 1,
    Internal = 2,
    Both = 3,
    Unknown = 4,
    Internal1 = 5,
    Internal2 = 6,
}
export declare enum BoardFileType {
    Gerber = 0,
    Drill = 1,
    Unsupported = 2,
}
export declare class GerberUtils {
    static boardFileType(fileName: string, content: string): BoardFileType;
    static determineSideAndLayer(fileName: string): {
        side: BoardSide;
        layer: BoardLayer;
    };
    static getFileExt(fileName: string): string;
    static getFileName(fileName: string): string;
    static bannedExtensions: string[];
}
