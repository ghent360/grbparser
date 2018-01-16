export declare enum BoardLayer {
    Copper = 0,
    SolderMask = 1,
    Silk = 2,
    Paste = 3,
    Drill = 4,
    Mill = 5,
    Outline = 6,
    Carbon = 7,
    Notes = 8,
    Assembly = 9,
    Mechanical = 10,
    Unknown = 11,
}
export declare enum BoardSide {
    Top = 0,
    Bottom = 1,
    Both = 2,
    Internal = 3,
    Unknown = 4,
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
