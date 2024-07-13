package ru.cs.korotaev.CollaborativeTextEditor.service

import jakarta.servlet.http.HttpServletResponse
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Service
import ru.cs.korotaev.CollaborativeTextEditor.dto.DocumentUpdate
import ru.cs.korotaev.CollaborativeTextEditor.dto.RenameRequest
import ru.cs.korotaev.CollaborativeTextEditor.model.Document
import ru.cs.korotaev.CollaborativeTextEditor.model.User
import ru.cs.korotaev.CollaborativeTextEditor.repository.DocumentRepository
import ru.cs.korotaev.CollaborativeTextEditor.repository.UserRepository
import java.io.File
import java.util.*

@Service
class DocumentService(

    private val documentRepository: DocumentRepository,
    private val userRepository: UserRepository,
    private val simpMessagingTemplate: SimpMessagingTemplate

) {

    fun updateDocument(update: DocumentUpdate): DocumentUpdate {
        val document = documentRepository.findById(update.id)
            .orElseThrow { RuntimeException("Document not found") }
        val filePath = "documents/${update.id}.txt"
        saveDocumentContent(filePath, update.content)
        simpMessagingTemplate.convertAndSend("/topic/updates/${update.id}", update)
        return DocumentUpdate(update.id, document.name, update.content, document.creator.username)
    }

    fun getDocumentContent(id: Long): String {
        val file = File("documents/$id.txt")
        return if (file.exists()) {
            file.readText()
        } else {
            throw RuntimeException("File not found")
        }
    }

    fun getDocumentName(id: Long): String {
        return documentRepository.findById(id).get().name
    }

    fun getDocumentById(id: Long): Optional<Document> {
        return documentRepository.findById(id)
    }

    fun renameDocument(request:RenameRequest) {
        val document = documentRepository.findById(request.id)
            .orElseThrow { RuntimeException("Document not found") }
        simpMessagingTemplate.convertAndSend("/topic/renameDocument", RenameRequest(request.id, request.newName))
        documentRepository.save(document.copy(name = request.newName))
    }

    fun createDocument(name: String, creatorId: Long): Document {
        val creator = userRepository.findById(creatorId)
            .orElseThrow { RuntimeException("User not found") }
        val document = documentRepository.save(Document(name = name, creator = creator))
        val filePath = "documents/${document.id}.txt"
        saveDocumentContent(filePath, "")
        simpMessagingTemplate.convertAndSend("/topic/newDocument", document)
        return document
    }

    fun downloadTxt(response: HttpServletResponse, id: Long) {
        val content = getDocumentContent(id)
        response.contentType = "text/plain"
        response.setHeader("Content-Disposition", "attachment; filename=document.txt")
        response.writer.write(content)
    }

    fun listDocuments(): List<Document> {
        return documentRepository.findAll()
    }

    private fun saveDocumentContent(filePath: String, content: String) {
        val file = File(filePath)
        file.parentFile.mkdirs()
        file.writeText(content)
    }

    fun deleteDocument(id: Long) {
        val document = documentRepository.findById(id)
            .orElseThrow { RuntimeException("Документ не найден") }
        val filePath = "documents/${id}.txt"
        File(filePath).delete()
        documentRepository.delete(document)
        simpMessagingTemplate.convertAndSend("/topic/deleteDocument", document)
    }

}