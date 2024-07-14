package ru.cs.korotaev.CollaborativeTextEditor.service

import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.stereotype.Service
import ru.cs.korotaev.CollaborativeTextEditor.dto.DocumentUpdate
import ru.cs.korotaev.CollaborativeTextEditor.dto.RenameRequest
import ru.cs.korotaev.CollaborativeTextEditor.model.Document
import ru.cs.korotaev.CollaborativeTextEditor.repository.DocumentRepository
import ru.cs.korotaev.CollaborativeTextEditor.repository.UserRepository
import java.io.File
import java.io.IOException
import java.util.*

@Service
class DocumentService(
    private val documentRepository: DocumentRepository,
    private val userRepository: UserRepository,
    private val simpMessagingTemplate: SimpMessagingTemplate
) {

    private val activeUsers = mutableMapOf<Long, MutableSet<String>>()

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

    fun addActiveUser(documentId: Long, username: String) {
        activeUsers.computeIfAbsent(documentId) { mutableSetOf() }.add(username)
        activeUsers[documentId]?.let { simpMessagingTemplate.convertAndSend("/topic/activeUsers/$documentId", it) }
    }

    fun removeActiveUser(documentId: Long, username: String) {
        activeUsers[documentId]?.remove(username)
        activeUsers[documentId]?.let { simpMessagingTemplate.convertAndSend("/topic/activeUsers/$documentId", it) }
    }

    fun getActiveUsers(documentId: Long): List<String> {
        return activeUsers[documentId]?.toList() ?: emptyList()
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

    fun downloadTxt(id: Long): ByteArray {
        val content = getDocumentContent(id)
        return content.toByteArray()
    }

    fun listDocuments(): List<Document> {
        return documentRepository.findAll()
    }

    private fun saveDocumentContent(filePath: String, content: String) {
        try {
            val file = File(filePath)
            if (!file.parentFile.exists()) {
                if (!file.parentFile.mkdirs()) {
                    throw IOException("Failed to create parent directories")
                }
            }
            file.writeText(content)
        } catch (e: IOException) {
            throw RuntimeException("Failed to save document content", e)
        }
    }

    fun deleteDocument(id: Long) {
        val document = documentRepository.findById(id)
            .orElseThrow { RuntimeException("Document not found") }
        val filePath = "documents/${id}.txt"
        File(filePath).delete()
        documentRepository.delete(document)
        simpMessagingTemplate.convertAndSend("/topic/deleteDocument", document)
    }

    fun getActiveUserUsernameById(id: Long): String {
        val userOptional = userRepository.findById(id)
        if (userOptional.isEmpty) {
            throw RuntimeException("User not found with id: $id")
        }
        return userOptional.get().username
    }

}