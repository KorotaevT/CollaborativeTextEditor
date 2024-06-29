package ru.cs.korotaev.CollaborativeTextEditor.service

import org.springframework.stereotype.Service
import ru.cs.korotaev.CollaborativeTextEditor.model.DocumentUpdate

@Service
class DocumentService {

    private var documentContent: String = ""

    fun updateDocument(update: DocumentUpdate): DocumentUpdate {
        documentContent = update.content
        return update
    }

    fun getDocumentContent(): String {
        return documentContent
    }

}