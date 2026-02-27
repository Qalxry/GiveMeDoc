-- table-style.lua — Separate table cell paragraphs from list Compact style.
--
-- Problem: Pandoc DOCX writer applies the "Compact" paragraph style to BOTH
-- tight list items and table cell contents (any Plain block inside a table).
-- This makes it impossible to style tables and lists independently.
--
-- Solution: Walk every Table element and convert Plain blocks inside cells
-- into Div{custom-style="Table Contents"} > Para. The "Table Contents"
-- paragraph style in the reference-doc controls table cell text appearance,
-- while "Compact" remains exclusively for tight list items.

function Table(tbl)
  return tbl:walk({
    Plain = function(p)
      return pandoc.Div(
        pandoc.Para(p.content),
        pandoc.Attr("", {}, {["custom-style"] = "Table Contents"})
      )
    end
  })
end
