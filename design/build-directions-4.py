src = open('directions-4.src.html').read()
text = open('assets/text.path').read()
mark = open('assets/mark.clean.path').read()
open('directions-4.html', 'w').write(src.replace('{{TEXT}}', text).replace('{{MARK}}', mark))
