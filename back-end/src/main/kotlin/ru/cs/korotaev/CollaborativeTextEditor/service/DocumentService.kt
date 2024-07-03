package ru.cs.korotaev.CollaborativeTextEditor.service

import jakarta.servlet.http.HttpServletResponse
import org.springframework.stereotype.Service
import ru.cs.korotaev.CollaborativeTextEditor.dto.DocumentUpdate
import java.io.File

@Service
class DocumentService {

    private var filePath = "documents/document.txt"
    private var documentContent: String = loadDocumentContent()

    fun updateDocument(update: DocumentUpdate): DocumentUpdate {
        filePath = "documents/${update.fileName}.txt"
        documentContent = update.content
        saveDocumentContent(documentContent)
        return update
    }

    fun getDocumentContent(fileName: String): String {
        val file = File("documents/$fileName.txt")
        return if (file.exists()) {
            file.readText()
        } else {
            throw RuntimeException("Файл не найден")
        }
    }

    fun renameDocument(oldName: String, newName: String) {
        val file = File("documents/$oldName.txt")
        val newFile = File(file.parent, "$newName.txt")
        if (file.renameTo(newFile)) {
            filePath = newFile.path
        } else {
            throw RuntimeException("Не удалось переименовать файл")
        }
    }

    fun createDocument(newName: String) {
        val newFile = File("documents/$newName.txt")
        newFile.createNewFile()
        filePath = newFile.path
        documentContent = ""
    }

    fun downloadTxt(response: HttpServletResponse) {
        response.contentType = "text/plain"
        response.setHeader("Content-Disposition", "attachment; filename=document.txt")
        response.writer.write(documentContent)
    }

    fun listDocuments(): List<String> {
        val folder = File("documents")
        return folder.listFiles { file -> file.isFile && file.extension == "txt" }
            ?.map { it.nameWithoutExtension }
            ?: emptyList()
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