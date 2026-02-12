def title_case(text):
    if not text:
        return text

    words = text.strip().split()
    formatted = []

    for word in words:
        if word.isupper() and len(word) > 1:
            formatted.append(word)
        else:
            formatted.append(word[0].upper() + word[1:].lower() if len(word) > 1 else word.upper())

    return " ".join(formatted)
