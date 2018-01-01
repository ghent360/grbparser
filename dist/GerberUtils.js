"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var BoardLayer;
(function (BoardLayer) {
    BoardLayer[BoardLayer["Silk"] = 0] = "Silk";
    BoardLayer[BoardLayer["Copper"] = 1] = "Copper";
    BoardLayer[BoardLayer["Paste"] = 2] = "Paste";
    BoardLayer[BoardLayer["SolderMask"] = 3] = "SolderMask";
    BoardLayer[BoardLayer["Carbon"] = 4] = "Carbon";
    BoardLayer[BoardLayer["Drill"] = 5] = "Drill";
    BoardLayer[BoardLayer["Outline"] = 6] = "Outline";
    BoardLayer[BoardLayer["Mill"] = 7] = "Mill";
    BoardLayer[BoardLayer["Unknown"] = 8] = "Unknown";
    BoardLayer[BoardLayer["Notes"] = 9] = "Notes";
    BoardLayer[BoardLayer["Assembly"] = 10] = "Assembly";
    BoardLayer[BoardLayer["Mechanical"] = 11] = "Mechanical";
})(BoardLayer = exports.BoardLayer || (exports.BoardLayer = {}));
var BoardSide;
(function (BoardSide) {
    BoardSide[BoardSide["Top"] = 0] = "Top";
    BoardSide[BoardSide["Bottom"] = 1] = "Bottom";
    BoardSide[BoardSide["Internal"] = 2] = "Internal";
    BoardSide[BoardSide["Both"] = 3] = "Both";
    BoardSide[BoardSide["Unknown"] = 4] = "Unknown";
    BoardSide[BoardSide["Internal1"] = 5] = "Internal1";
    BoardSide[BoardSide["Internal2"] = 6] = "Internal2";
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
    { fileString: ".internalplane1", boardType: { side: BoardSide.Internal1, layer: BoardLayer.Copper } },
    { fileString: ".internalplane2", boardType: { side: BoardSide.Internal2, layer: BoardLayer.Copper } },
];
class GerberUtils {
    static boardFileType(fileName, content) {
        let fileSplit = fileName.split(".");
        let ext = fileSplit[fileSplit.length - 1].toLowerCase();
        if (ext in ["config", "exe", "dll", "png", "zip", "gif", "jpeg", "doc", "docx", "jpg", "bmp"]) {
            return BoardFileType.Unsupported;
        }
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
                        result = { side: BoardSide.Internal1, layer: BoardLayer.Copper };
                        break;
                    case "inner2":
                        result = { side: BoardSide.Internal2, layer: BoardLayer.Copper };
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
                        break;
                }
                break;
            case "ger":
                for (let descriptor of gerFileDescriptors) {
                    if (fileNameLowerCase.indexOf(descriptor.fileString) >= 0) {
                        result = descriptor.boardType;
                        break;
                    }
                }
                break;
            case "gml":
                result = { side: BoardSide.Both, layer: BoardLayer.Mill };
                break;
            case "fabrd":
            case "oln":
            case "gko":
                result = { side: BoardSide.Both, layer: BoardLayer.Outline };
                break;
            case "l2":
            case "gl1":
            case "g2l":
                result = { side: BoardSide.Internal1, layer: BoardLayer.Copper };
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
            case "l3":
            case "gl2":
            case "g3l":
                result = { side: BoardSide.Internal2, layer: BoardLayer.Copper };
                break;
            case "l4":
            case "gbl":
            case "l2m":
                result = { side: BoardSide.Bottom, layer: BoardLayer.Copper };
                break;
            case "l1":
            case "l1m":
            case "gtl":
                result = { side: BoardSide.Top, layer: BoardLayer.Copper };
                break;
            case "gbp":
            case "spbottom":
                result = { side: BoardSide.Bottom, layer: BoardLayer.Paste };
                break;
            case "gtp":
            case "sptop":
                result = { side: BoardSide.Top, layer: BoardLayer.Paste };
                break;
            case "gbo":
            case "ss2":
            case "ssbottom":
                result = { side: BoardSide.Bottom, layer: BoardLayer.Silk };
                break;
            case "gto":
            case "ss1":
            case "sstop":
                result = { side: BoardSide.Top, layer: BoardLayer.Silk };
                break;
            case "gbs":
            case "sm2":
            case "smbottom":
                result = { side: BoardSide.Bottom, layer: BoardLayer.SolderMask };
                break;
            case "gts":
            case "sm1":
            case "smtop":
                result = { side: BoardSide.Top, layer: BoardLayer.SolderMask };
                break;
            case "gb3":// oshstencils bottom outline
                result = { side: BoardSide.Both, layer: BoardLayer.Outline };
                break;
            case "gt3":// oshstencils top outline
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
            case "drill":
            case "drillnpt":
                result = { side: BoardSide.Both, layer: BoardLayer.Drill };
                break;
        }
        return result;
    }
}
exports.GerberUtils = GerberUtils;
//# sourceMappingURL=GerberUtils.js.map