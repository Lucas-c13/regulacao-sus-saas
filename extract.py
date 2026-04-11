import sys
import subprocess

try:
    import pypdf
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "pypdf"])
    import pypdf

reader = pypdf.PdfReader("SaaS de Agendamento.pdf")
text = ""
for page in reader.pages:
    text += page.extract_text() + "\n"

with open("SaaS_de_Agendamento_text.txt", "w", encoding="utf-8") as f:
    f.write(text)
