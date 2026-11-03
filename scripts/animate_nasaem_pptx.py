"""Add native PowerPoint entrances and vector accents to an exported deck."""

import argparse
import io
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

P = "http://schemas.openxmlformats.org/presentationml/2006/main"
A = "http://schemas.openxmlformats.org/drawingml/2006/main"
NS = {"p": P, "a": A}


def node(parent, tag, **attrs):
    prefix, local = tag.split(":")
    return ET.SubElement(parent, f"{{{NS[prefix]}}}{local}", {
        key: str(value) for key, value in attrs.items()
    })


def text_of(shape):
    return "".join(shape.itertext())


def add_accents(tree, slide_number):
    """Place editable accents in the middle footer, away from page numbers."""
    for shape in list(tree.findall("p:sp", NS)):
        identity = shape.find("p:nvSpPr/p:cNvPr", NS)
        if identity is not None and identity.get("name", "").startswith("Nasaem vector accent"):
            tree.remove(shape)
    used = [int(el.get("id")) for el in tree.findall(".//p:cNvPr", NS)]
    shape_id = max(used) + 1
    motifs = [
        "sun", "flowChartProcess", "roundRect", "cube",
        "flowChartDocument", "hexagon", "cube", "leftRightArrow",
        "upArrow", "mathMinus", "hexagon", "heart",
    ]
    shapes = [
        (4.30, 5.24, 0.12, 0.12, "ellipse", "A32E28"),
        (4.52, 5.24, 0.12, 0.12, "ellipse", "F0C84E"),
        (4.74, 5.24, 0.12, 0.12, "ellipse", "244A3B"),
        (4.99, 5.16, 0.25, 0.25, motifs[slide_number - 1], "244A3B"),
    ]
    for x, y, w, h, preset, color in shapes:
        shape = node(tree, "p:sp")
        nv = node(shape, "p:nvSpPr")
        node(nv, "p:cNvPr", id=shape_id, name=f"Nasaem vector accent {shape_id}")
        node(nv, "p:cNvSpPr")
        node(nv, "p:nvPr")
        props = node(shape, "p:spPr")
        transform = node(props, "a:xfrm")
        node(transform, "a:off", x=round(x * 914400), y=round(y * 914400))
        node(transform, "a:ext", cx=round(w * 914400), cy=round(h * 914400))
        geometry = node(props, "a:prstGeom", prst=preset)
        node(geometry, "a:avLst")
        fill = node(props, "a:solidFill")
        node(fill, "a:srgbClr", val=color)
        node(node(props, "a:ln"), "a:noFill")
        shape_id += 1


def add_timing(slide):
    tree = slide.find("p:cSld/p:spTree", NS)
    headlines, details = [], []
    paragraph_shapes = set()
    for shape in tree.findall("p:sp", NS):
        body = shape.find("p:txBody", NS)
        if body is None:
            continue
        paragraphs = body.findall("a:p", NS)
        text = text_of(body).strip()
        if not text or text == "Replit":
            continue
        shape_id = shape.find("p:nvSpPr/p:cNvPr", NS).get("id")
        sizes = [int(r.get("sz", "0")) for r in body.findall(".//a:rPr", NS)]
        offset = shape.find("p:spPr/a:xfrm/a:off", NS)
        y = int(offset.get("y", "0")) if offset is not None else 0
        if max(sizes, default=0) >= 2400:
            headlines.append((y, shape_id, None))
        else:
            for index, paragraph in enumerate(paragraphs):
                if not text_of(paragraph).strip():
                    continue
                target = index if len(paragraphs) > 1 else None
                details.append((y, shape_id, target))
                if target is not None:
                    paragraph_shapes.add(shape_id)
    headlines.sort(key=lambda entry: entry[0])
    details.sort(key=lambda entry: entry[0])
    # Titles appear together as the slide opens; each remaining point has a click.
    steps = [headlines] if headlines else []
    steps.extend([[entry] for entry in details])
    timing = node(slide, "p:timing")
    root_list = node(timing, "p:tnLst")
    root = node(node(root_list, "p:par"), "p:cTn",
                id=1, dur="indefinite", restart="never", nodeType="tmRoot")
    sequence = node(node(root, "p:childTnLst"), "p:seq",
                    concurrent=1, nextAc="seek")
    main = node(sequence, "p:cTn", id=2, dur="indefinite", nodeType="mainSeq")
    children = node(main, "p:childTnLst")
    next_id = 3

    def ct(parent, **attrs):
        nonlocal next_id
        result = node(parent, "p:cTn", id=next_id, **attrs)
        next_id += 1
        return result

    def target(parent, shape_id, paragraph):
        shape_target = node(node(parent, "p:tgtEl"), "p:spTgt", spid=shape_id)
        if paragraph is not None:
            node(node(shape_target, "p:txEl"), "p:pRg",
                 st=paragraph, end=paragraph)

    for step_index, entries in enumerate(steps):
        click = ct(node(children, "p:par"), fill="hold")
        node(node(click, "p:stCondLst"), "p:cond",
             delay=0 if step_index == 0 else "indefinite")
        sub = ct(node(node(click, "p:childTnLst"), "p:par"), fill="hold")
        node(node(sub, "p:stCondLst"), "p:cond", delay=0)
        effect_list = node(sub, "p:childTnLst")
        for _, shape_id, paragraph in entries:
            effect = ct(node(effect_list, "p:par"), presetID=10,
                        presetClass="entr", presetSubtype=0, fill="hold",
                        grpId=0, nodeType="afterEffect" if step_index == 0 else "clickEffect")
            node(node(effect, "p:stCondLst"), "p:cond", delay=0)
            behaviors = node(effect, "p:childTnLst")
            visibility = node(behaviors, "p:set")
            common = node(visibility, "p:cBhvr")
            instant = ct(common, dur=1, fill="hold")
            node(node(instant, "p:stCondLst"), "p:cond", delay=0)
            target(common, shape_id, paragraph)
            node(node(common, "p:attrNameLst"), "p:attrName").text = "style.visibility"
            node(node(visibility, "p:to"), "p:strVal", val="visible")
            fade = node(behaviors, "p:animEffect", transition="in", filter="fade")
            common = node(fade, "p:cBhvr")
            ct(common, dur=450, fill="hold")
            target(common, shape_id, paragraph)
    for tag, event in [("p:prevCondLst", "onPrev"), ("p:nextCondLst", "onNext")]:
        condition = node(node(sequence, tag), "p:cond", evt=event, delay=0)
        node(node(condition, "p:tgtEl"), "p:sldTgt")
    if paragraph_shapes:
        builds = node(timing, "p:bldLst")
        for shape_id in sorted(paragraph_shapes, key=int):
            node(builds, "p:bldP", spid=shape_id, grpId=0, build="p")
    return len(steps), sum(len(entries) for entries in steps)


def enhance(path, author=None):
    output = io.BytesIO()
    totals = []
    with zipfile.ZipFile(path) as source, zipfile.ZipFile(output, "w") as dest:
        for info in source.infolist():
            data = source.read(info.filename)
            name = info.filename
            if name == "docProps/core.xml" and author:
                core = ET.fromstring(data)
                for uri, local in [
                    ("http://purl.org/dc/elements/1.1/", "creator"),
                    ("http://schemas.openxmlformats.org/package/2006/metadata/core-properties", "lastModifiedBy"),
                ]:
                    field = core.find(f"{{{uri}}}{local}")
                    if field is None:
                        field = ET.SubElement(core, f"{{{uri}}}{local}")
                    field.text = author
                data = ET.tostring(core, encoding="utf-8", xml_declaration=True)
            if name.startswith("ppt/slides/slide") and name.endswith(".xml"):
                slide_number = int(name.rsplit("slide", 1)[1].split(".")[0])
                # Preserve extension namespace prefixes as well as standard ones.
                for _, pair in ET.iterparse(io.BytesIO(data), events=["start-ns"]):
                    prefix, uri = pair
                    ET.register_namespace(prefix, uri)
                root = ET.fromstring(data)
                original_text = [text_of(s.find("p:txBody", NS))
                                 for s in root.findall(".//p:sp", NS)
                                 if s.find("p:txBody", NS) is not None]
                for old in list(root):
                    if old.tag in {f"{{{P}}}transition", f"{{{P}}}timing"}:
                        root.remove(old)
                add_accents(root.find("p:cSld/p:spTree", NS), slide_number)
                transition = node(root, "p:transition", spd="med", advClick=1)
                node(transition, "p:fade")
                steps, targets = add_timing(root)
                # Transition and timing precede an optional extension list.
                ext = root.find("p:extLst", NS)
                if ext is not None:
                    root.remove(ext)
                    root.append(ext)
                current_text = [text_of(s.find("p:txBody", NS))
                                for s in root.findall(".//p:sp", NS)
                                if s.find("p:txBody", NS) is not None]
                assert original_text == current_text, "Text content changed"
                ids = [c.get("id") for c in root.findall(".//p:cTn", NS)]
                assert len(ids) == len(set(ids)), "Duplicate timing IDs"
                shape_ids = {c.get("id") for c in root.findall(".//p:cNvPr", NS)}
                assert all(t.get("spid") in shape_ids
                           for t in root.findall(".//p:spTgt", NS))
                totals.append((slide_number, steps, targets))
                data = ET.tostring(root, encoding="utf-8", xml_declaration=True)
            dest.writestr(info, data)
    assert len(totals) == 12, f"Expected 12 slides; found {len(totals)}"
    path.write_bytes(output.getvalue())
    with zipfile.ZipFile(path) as result:
        assert result.testzip() is None
        for name in result.namelist():
            if name.endswith((".xml", ".rels")):
                ET.fromstring(result.read(name))
    for number, steps, targets in sorted(totals):
        print(f"Slide {number}: {targets} entrances, {steps - 1} clicks, 4 vector accents")
    print(f"Verified all XML, relationships, target IDs, text preservation: {path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", type=Path)
    parser.add_argument("--author", help="Creator attribution in PowerPoint file properties")
    arguments = parser.parse_args()
    enhance(arguments.file, author=arguments.author)
