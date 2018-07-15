"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var BoardLayer;
(function (BoardLayer) {
    BoardLayer[BoardLayer["Copper"] = 0] = "Copper";
    BoardLayer[BoardLayer["SolderMask"] = 1] = "SolderMask";
    BoardLayer[BoardLayer["Silk"] = 2] = "Silk";
    BoardLayer[BoardLayer["Paste"] = 3] = "Paste";
    BoardLayer[BoardLayer["Drill"] = 4] = "Drill";
    BoardLayer[BoardLayer["Mill"] = 5] = "Mill";
    BoardLayer[BoardLayer["Outline"] = 6] = "Outline";
    BoardLayer[BoardLayer["Carbon"] = 7] = "Carbon";
    BoardLayer[BoardLayer["Notes"] = 8] = "Notes";
    BoardLayer[BoardLayer["Assembly"] = 9] = "Assembly";
    BoardLayer[BoardLayer["Mechanical"] = 10] = "Mechanical";
    BoardLayer[BoardLayer["Unknown"] = 11] = "Unknown";
})(BoardLayer = exports.BoardLayer || (exports.BoardLayer = {}));
var BoardSide;
(function (BoardSide) {
    BoardSide[BoardSide["Top"] = 0] = "Top";
    BoardSide[BoardSide["Bottom"] = 1] = "Bottom";
    BoardSide[BoardSide["Both"] = 2] = "Both";
    BoardSide[BoardSide["Internal"] = 3] = "Internal";
    BoardSide[BoardSide["Unknown"] = 4] = "Unknown";
})(BoardSide = exports.BoardSide || (exports.BoardSide = {}));
var BoardFileType;
(function (BoardFileType) {
    BoardFileType[BoardFileType["Gerber"] = 0] = "Gerber";
    BoardFileType[BoardFileType["Drill"] = 1] = "Drill";
    BoardFileType[BoardFileType["Unsupported"] = 2] = "Unsupported";
})(BoardFileType = exports.BoardFileType || (exports.BoardFileType = {}));
class FileNameDescriptor {
}
const gerFileDescriptors = [
    { fileString: ".topsoldermask", boardType: { side: BoardSide.Top, layer: BoardLayer.SolderMask } },
    { fileString: ".topsilkscreen", boardType: { side: BoardSide.Top, layer: BoardLayer.Silk } },
    { fileString: ".toplayer", boardType: { side: BoardSide.Top, layer: BoardLayer.Copper } },
    { fileString: ".tcream", boardType: { side: BoardSide.Top, layer: BoardLayer.Paste } },
    { fileString: ".boardoutline", boardType: { side: BoardSide.Both, layer: BoardLayer.Outline } },
    { fileString: ".bcream", boardType: { side: BoardSide.Bottom, layer: BoardLayer.SolderMask } },
    { fileString: ".bottomsoldermask", boardType: { side: BoardSide.Bottom, layer: BoardLayer.SolderMask } },
    { fileString: ".bottomsilkscreen", boardType: { side: BoardSide.Bottom, layer: BoardLayer.Silk } },
    { fileString: ".bottomlayer", boardType: { side: BoardSide.Bottom, layer: BoardLayer.Copper } },
    { fileString: ".bcream", boardType: { side: BoardSide.Bottom, layer: BoardLayer.Paste } },
    { fileString: ".internalplane1", boardType: { side: BoardSide.Internal, layer: BoardLayer.Copper } },
    { fileString: ".internalplane2", boardType: { side: BoardSide.Internal, layer: BoardLayer.Copper } },
];
class GerberUtils {
    static boardFileType(content) {
        if (content.indexOf("%FS") >= 0)
            return BoardFileType.Gerber;
        if (content.indexOf("M48") >= 0)
            return BoardFileType.Drill;
        return BoardFileType.Unsupported;
    }
    static determineSideAndLayer(fileName) {
        let result = { side: BoardSide.Unknown, layer: BoardLayer.Unknown };
        let fileSplit = fileName.split('.');
        let ext = fileSplit[fileSplit.length - 1].toLowerCase();
        let fileNameLowerCase = fileName.toLowerCase();
        switch (ext) {
            case "gbr":
            case "grb":
            case "ger":
            case "art":
                let fileNameNoExt = fileSplit[0].toLowerCase();
                switch (fileNameNoExt) {
                    case "boardoutline":
                        result = { side: BoardSide.Both, layer: BoardLayer.Outline };
                        break;
                    case "outline":
                        result = { side: BoardSide.Both, layer: BoardLayer.Outline };
                        break;
                    case "board":
                        result = { side: BoardSide.Both, layer: BoardLayer.Outline };
                        break;
                    case "bottom":
                        result = { side: BoardSide.Bottom, layer: BoardLayer.Copper };
                        break;
                    case "bottommask":
                        result = { side: BoardSide.Bottom, layer: BoardLayer.SolderMask };
                        break;
                    case "bottompaste":
                        result = { side: BoardSide.Bottom, layer: BoardLayer.Paste };
                        break;
                    case "bottomsilk":
                        result = { side: BoardSide.Bottom, layer: BoardLayer.Silk };
                        break;
                    case "top":
                        result = { side: BoardSide.Top, layer: BoardLayer.Copper };
                        break;
                    case "topmask":
                        result = { side: BoardSide.Top, layer: BoardLayer.SolderMask };
                        break;
                    case "toppaste":
                        result = { side: BoardSide.Top, layer: BoardLayer.Paste };
                        break;
                    case "topsilk":
                        result = { side: BoardSide.Top, layer: BoardLayer.Silk };
                        break;
                    case "inner1":
                    case "inner2":
                        result = { side: BoardSide.Internal, layer: BoardLayer.Copper };
                        break;
                    default:
                        if (fileNameLowerCase.indexOf("outline") >= 0) {
                            result = { side: BoardSide.Both, layer: BoardLayer.Outline };
                        }
                        else if (fileNameLowerCase.indexOf("-edge_cuts") >= 0) {
                            result = { side: BoardSide.Both, layer: BoardLayer.Outline };
                        }
                        else if (fileNameLowerCase.indexOf("-b_cu") >= 0) {
                            result = { side: BoardSide.Bottom, layer: BoardLayer.Copper };
                        }
                        else if (fileNameLowerCase.indexOf("-f_cu") >= 0) {
                            result = { side: BoardSide.Top, layer: BoardLayer.Copper };
                        }
                        else if (fileNameLowerCase.indexOf("-b_silks") >= 0) {
                            result = { side: BoardSide.Bottom, layer: BoardLayer.Silk };
                        }
                        else if (fileNameLowerCase.indexOf("-f_silks") >= 0) {
                            result = { side: BoardSide.Top, layer: BoardLayer.Silk };
                        }
                        else if (fileNameLowerCase.indexOf("-b_mask") >= 0) {
                            result = { side: BoardSide.Bottom, layer: BoardLayer.SolderMask };
                        }
                        else if (fileNameLowerCase.indexOf("-f_mask") >= 0) {
                            result = { side: BoardSide.Top, layer: BoardLayer.SolderMask };
                        }
                        else if (fileNameLowerCase.indexOf("-b_paste") >= 0) {
                            result = { side: BoardSide.Bottom, layer: BoardLayer.Paste };
                        }
                        else if (fileNameLowerCase.indexOf("-f_paste") >= 0) {
                            result = { side: BoardSide.Top, layer: BoardLayer.Paste };
                        }
                        else if (fileNameLowerCase.indexOf("_fab") >= 0) {
                            result = { side: BoardSide.Both, layer: BoardLayer.Outline };
                        }
                        else if (fileNameLowerCase.indexOf("_bslk") >= 0) {
                            result = { side: BoardSide.Bottom, layer: BoardLayer.Silk };
                        }
                        else if (fileNameLowerCase.indexOf("_tslk") >= 0) {
                            result = { side: BoardSide.Top, layer: BoardLayer.Silk };
                        }
                        else if (fileNameLowerCase.indexOf("_smc") >= 0) {
                            result = { side: BoardSide.Top, layer: BoardLayer.SolderMask };
                        }
                        else if (fileNameLowerCase.indexOf("_sms") >= 0) {
                            result = { side: BoardSide.Bottom, layer: BoardLayer.SolderMask };
                        }
                        else if (fileNameLowerCase.indexOf("_spc") >= 0) {
                            result = { side: BoardSide.Top, layer: BoardLayer.Paste };
                        }
                        else if (fileNameLowerCase.indexOf("_sps") >= 0) {
                            result = { side: BoardSide.Bottom, layer: BoardLayer.Paste };
                        }
                        else if (fileNameLowerCase.indexOf("_lyr1") >= 0) {
                            result = { side: BoardSide.Internal, layer: BoardLayer.Copper };
                        }
                        else if (fileNameLowerCase.indexOf("_lyr2") >= 0) {
                            result = { side: BoardSide.Internal, layer: BoardLayer.Copper };
                        }
                        else if (fileNameLowerCase.indexOf("_lyr3") >= 0) {
                            result = { side: BoardSide.Internal, layer: BoardLayer.Copper };
                        }
                        else if (fileNameLowerCase.indexOf("_lyr4") >= 0) {
                            result = { side: BoardSide.Internal, layer: BoardLayer.Copper };
                        }
                        else if (fileNameLowerCase.indexOf("_lyr5") >= 0) {
                            result = { side: BoardSide.Internal, layer: BoardLayer.Copper };
                        }
                        else if (fileNameLowerCase.indexOf("_lyr6") >= 0) {
                            result = { side: BoardSide.Internal, layer: BoardLayer.Copper };
                        }
                        else if (fileNameLowerCase.indexOf("_lyr7") >= 0) {
                            result = { side: BoardSide.Internal, layer: BoardLayer.Copper };
                        }
                        else if (fileNameLowerCase.indexOf("_lyr8") >= 0) {
                            result = { side: BoardSide.Internal, layer: BoardLayer.Copper };
                        }
                        else {
                            let side = BoardSide.Unknown;
                            let layer = BoardLayer.Unknown;
                            if (fileNameLowerCase.indexOf("top") >= 0) {
                                side = BoardSide.Top;
                                layer = BoardLayer.Copper;
                            }
                            else if (fileNameLowerCase.indexOf("bot") >= 0) {
                                side = BoardSide.Bottom;
                                layer = BoardLayer.Copper;
                            }
                            else if (fileNameLowerCase.indexOf("board") >= 0) {
                                side = BoardSide.Both;
                            }
                            if (fileNameLowerCase.indexOf("copper") >= 0) {
                                layer = BoardLayer.Copper;
                            }
                            else if (fileNameLowerCase.indexOf("paste") >= 0
                                || fileNameLowerCase.indexOf("cream") >= 0) {
                                layer = BoardLayer.Paste;
                            }
                            else if (fileNameLowerCase.indexOf("mask") >= 0) {
                                layer = BoardLayer.SolderMask;
                            }
                            else if (fileNameLowerCase.indexOf("silk") >= 0) {
                                layer = BoardLayer.Silk;
                            }
                            else if (fileNameLowerCase.indexOf("Asm") >= 0
                                || fileNameLowerCase.indexOf("Assm") >= 0
                                || fileNameLowerCase.indexOf("Assy") >= 0
                                || fileNameLowerCase.indexOf("Assem") >= 0) {
                                layer = BoardLayer.Assembly;
                            }
                            else if (fileNameLowerCase.indexOf("outline") >= 0
                                || fileNameLowerCase.indexOf("dimension") >= 0) {
                                layer = BoardLayer.Outline;
                            }
                            else if (fileNameLowerCase.indexOf("layer") >= 0) {
                                layer = BoardLayer.Copper;
                                side = BoardSide.Internal;
                            }
                            if (layer != BoardLayer.Unknown && side != BoardSide.Unknown) {
                                result = { side: side, layer: layer };
                            }
                        }
                        break;
                }
                if (result.side == BoardSide.Unknown) {
                    for (let descriptor of gerFileDescriptors) {
                        if (fileNameLowerCase.indexOf(descriptor.fileString) >= 0) {
                            result = descriptor.boardType;
                            break;
                        }
                    }
                }
                break;
            case "gml":
                result = { side: BoardSide.Both, layer: BoardLayer.Mill };
                break;
            case "fabrd":
            case "oln":
            case "gko":
            case "outline":
            case "gmb":
                result = { side: BoardSide.Both, layer: BoardLayer.Outline };
                break;
            case "l2":
            case "g2":
            case "gl1":
            case "g2l":
            case "l3":
            case "g3":
            case "gl2":
            case "g3l":
            case "lo1":
            case "lo2":
            case "lo3":
            case "lo4":
                result = { side: BoardSide.Internal, layer: BoardLayer.Copper };
                break;
            case "adtop":
                result = { side: BoardSide.Top, layer: BoardLayer.Assembly };
                break;
            case "adbottom":
                result = { side: BoardSide.Bottom, layer: BoardLayer.Assembly };
                break;
            case "notes":
                result = { side: BoardSide.Both, layer: BoardLayer.Notes };
                break;
            case "l4":
            case "gbl":
            case "l2m":
            case "sol":
                result = { side: BoardSide.Bottom, layer: BoardLayer.Copper };
                break;
            case "l1":
            case "l1m":
            case "gtl":
            case "cmp":
                result = { side: BoardSide.Top, layer: BoardLayer.Copper };
                break;
            case "gbp":
            case "spbottom":
            case "pms":
            case "crs":
                result = { side: BoardSide.Bottom, layer: BoardLayer.Paste };
                break;
            case "gtp":
            case "sptop":
            case "pmc":
            case "crc":
                result = { side: BoardSide.Top, layer: BoardLayer.Paste };
                break;
            case "gbo":
            case "ss2":
            case "ssbottom":
            case "pls":
                result = { side: BoardSide.Bottom, layer: BoardLayer.Silk };
                break;
            case "gto":
            case "ss1":
            case "sstop":
            case "plc":
                result = { side: BoardSide.Top, layer: BoardLayer.Silk };
                break;
            case "gbs":
            case "sm2":
            case "smbottom":
            case "sts":
                result = { side: BoardSide.Bottom, layer: BoardLayer.SolderMask };
                break;
            case "gts":
            case "sm1":
            case "smtop":
            case "stc":
                result = { side: BoardSide.Top, layer: BoardLayer.SolderMask };
                break;
            case "gb3": // oshstencils bottom outline
                result = { side: BoardSide.Both, layer: BoardLayer.Outline };
                break;
            case "gt3": // oshstencils top outline
                result = { side: BoardSide.Both, layer: BoardLayer.Outline };
                break;
            case "top":
                result = { side: BoardSide.Top, layer: BoardLayer.Copper };
                break;
            case "bottom":
            case "bot":
                result = { side: BoardSide.Bottom, layer: BoardLayer.Copper };
                break;
            case "smb":
                result = { side: BoardSide.Bottom, layer: BoardLayer.SolderMask };
                break;
            case "smt":
                result = { side: BoardSide.Top, layer: BoardLayer.SolderMask };
                break;
            case "slk":
            case "sst":
                result = { side: BoardSide.Top, layer: BoardLayer.Silk };
                break;
            case "bsk":
            case "ssb":
                result = { side: BoardSide.Bottom, layer: BoardLayer.Silk };
                break;
            case "spt":
                result = { side: BoardSide.Top, layer: BoardLayer.Paste };
                break;
            case "spb":
                result = { side: BoardSide.Bottom, layer: BoardLayer.Paste };
                break;
            case "gpb":
                result = { side: BoardSide.Bottom, layer: BoardLayer.Paste };
                break;
            case "gpt":
                result = { side: BoardSide.Top, layer: BoardLayer.Paste };
                break;
            case "gm1":
            case "gm2":
            case "gm3":
            case "gm4":
            case "gm5":
            case "gm6":
            case "gm7":
            case "gm8":
            case "gm9":
            case "gm10":
            case "gm11":
            case "gm12":
            case "gm13":
            case "gm14":
            case "gm15":
            case "gm16":
            case "gm17":
            case "gm18":
            case "gm19":
            case "gm20":
                result = { side: BoardSide.Both, layer: BoardLayer.Mechanical };
                break;
            case "drill_TOP_BOTTOM":
            case "drl":
            case "xln":
            //case "dri":
            case "drill":
            case "drillnpt":
                result = { side: BoardSide.Both, layer: BoardLayer.Drill };
                break;
        }
        return result;
    }
    static getFileExt(fileName) {
        let dotIdx = fileName.lastIndexOf(".");
        if (dotIdx < 0) {
            return "";
        }
        return fileName.substring(dotIdx + 1);
    }
    static getFileName(fileName) {
        let dotIdx = fileName.lastIndexOf("/");
        if (dotIdx < 0) {
            return fileName;
        }
        return fileName.substring(dotIdx + 1);
    }
}
GerberUtils.bannedExtensions = [
    "c",
    "o",
    "s",
    "ld",
    "a",
    "so",
    "cc",
    "cpp",
    "cxx",
    "h",
    "hxx",
    "py",
    "doc",
    "dsn",
    "schdoc",
    "pcbdoc",
    "json",
    "dwg",
    "dxf",
    "xls",
    "xlsx",
    "v",
    "vhdl",
    "vhd",
    "vhi",
    "exe",
    "dll",
    "lib",
    "lst",
    "mod",
    "csv",
    "dcm",
    "png",
    "jpg",
    "bmp",
    "gif",
    "xbm",
    "tif",
    "tiff",
    "ps",
    "ttf",
    "html",
    "htm",
    "svg",
    "css",
    "js",
    "map",
    "md5",
    "ino",
    "hex",
    "psm",
    "ucf",
    "ncf",
    "bat",
    "tcl",
    "sh",
    "key",
    "fmt",
    "gise",
    "sym",
    "vho",
    "xco",
    "xdc",
    "xise",
    "bit",
    "bin",
    "xwbt",
    "do",
    "sv",
    "outputstatus",
    "apr_lib",
    "apr",
    "extrep",
    "rul",
    "rpt",
    "pdf",
    //"xln",
    "gpi",
    "kicad_pcb",
    "prjpcb",
    "project",
    "cproject",
    "net",
    //"dri",
    "drr",
    "rep",
    "info",
    "tool",
    "cfg",
    "epf",
    "ini",
    "gitignore",
    "gitattributes",
    "zip",
    "md",
    "sch",
    "brd",
    "s#1",
    "s#2",
    "s#3",
    "s#4",
    "s#5",
    "s#6",
    "s#7",
    "s#8",
    "s#9",
    "b#1",
    "b#2",
    "b#3",
    "b#4",
    "b#5",
    "b#6",
    "b#7",
    "b#8",
    "b#9",
];
exports.GerberUtils = GerberUtils;
//# sourceMappingURL=gerberutils.js.map