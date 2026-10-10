from pathlib import Path
from reportlab.pdfgen.canvas import Canvas
from reportlab.lib.colors import HexColor
from pypdf import PdfReader
root=Path(__file__).resolve().parent
path=root/'fixture-320.pdf'
c=Canvas(str(path),pagesize=(420,594),pageCompression=1)
c.setTitle('320-page rendering fixture - original test content')
for i in range(1,321):
 c.setFillColor(HexColor('#fbf8f0'));c.rect(0,0,420,594,stroke=0,fill=1)
 c.setFillColor(HexColor('#364653'));c.setFont('Times-Roman',10);c.drawCentredString(210,557,'THE MIDNIGHT ARCHIVE - PDF TEST FIXTURE')
 c.setStrokeColor(HexColor('#b5ab97'));c.line(53,544,367,544)
 c.setFont('Times-Roman',24);c.drawString(53,493,f'Chapter {(i-1)//16+1}')
 c.setFont('Times-Roman',12)
 for line in range(15):
  c.drawString(53,448-line*23,f'Page {i:03d}, line {line+1:02d}. A clue waits beneath the clock.')
 c.setFont('Times-Roman',10);c.drawCentredString(210,40,str(i));c.showPage()
c.save()
r=PdfReader(path)
assert len(r.pages)==320
for i in [0,159,319]:assert f'Page {i+1:03d}' in r.pages[i].extract_text()
print(path, path.stat().st_size, 'bytes; 320 pages verified')
