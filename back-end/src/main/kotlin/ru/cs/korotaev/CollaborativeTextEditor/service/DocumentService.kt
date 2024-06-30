package ru.cs.korotaev.CollaborativeTextEditor.service

import org.springframework.stereotype.Service
import ru.cs.korotaev.CollaborativeTextEditor.model.DocumentUpdate
import java.io.File

@Service
class DocumentService {

    private val filePath = "documents/document.txt"
    private lateinit var documentContent: String

    init {
        documentContent = loadDocumentContent()
    }

    fun updateDocument(update: DocumentUpdate): DocumentUpdate {
        documentContent = update.content
        saveDocumentContent(documentContent)
        return update
    }

    fun getDocumentContent(): String {
        return documentContent
    }

    private fun saveDocumentContent(content: String) {
        val file = File(filePath)
        file.parentFile.mkdirs()
        file.writeText(content)
    }

    private fun loadDocumentContent(): String {
        val file = File(filePath)
        return if (file.exists()) {
            file.readText()
        } else {
            ""
        }
    }
}