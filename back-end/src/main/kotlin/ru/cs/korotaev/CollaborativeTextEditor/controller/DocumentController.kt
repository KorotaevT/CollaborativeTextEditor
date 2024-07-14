package ru.cs.korotaev.CollaborativeTextEditor.controller

import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.messaging.handler.annotation.DestinationVariable
import org.springframework.messaging.handler.annotation.MessageMapping
import org.springframework.messaging.handler.annotation.SendTo
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException
import ru.cs.korotaev.CollaborativeTextEditor.dto.DocumentUpdate
import ru.cs.korotaev.CollaborativeTextEditor.dto.NewDocumentRequest
import ru.cs.korotaev.CollaborativeTextEditor.dto.RenameRequest
import ru.cs.korotaev.CollaborativeTextEditor.model.Document
import ru.cs.korotaev.CollaborativeTextEditor.model.User
import ru.cs.korotaev.CollaborativeTextEditor.repository.UserRepository
import ru.cs.korotaev.CollaborativeTextEditor.service.DocumentService
import ru.cs.korotaev.CollaborativeTextEditor.service.JwtService

@RestController
@RequestMapping("/api")
class DocumentController(
    private val documentService: DocumentService,
    private val jwtService: JwtService,
    private val userRepository: UserRepository
){

    @MessageMapping("/updateDocument/{id}")
    @SendTo("/topic/updates/{id}")
    fun updateDocument(@DestinationVariable id: Long, update: DocumentUpdate): DocumentUpdate {
        return documentService.updateDocument(update)
    }

    @MessageMapping("/activeUsers/{documentId}")
    @SendTo("/topic/activeUsers/{id}")
    fun handleActiveUsers(@DestinationVariable documentId: Long, payload: Map<String, String>) {
        val username = payload["username"] ?: return
        val action = payload["action"] ?: return

        if (action == "connect") {
            documentService.addActiveUser(documentId, username)
        } else if (action == "disconnect") {
            documentService.removeActiveUser(documentId, username)
        }
    }

    @GetMapping("/activeUsers/{id}")
    fun getActiveUsers(@PathVariable id: Long): List<String> {
        return documentService.getActiveUsers(id)
    }

    @GetMapping("/getDocument/{id}")
    fun getDocument(@PathVariable id: Long): DocumentUpdate {
        return try {
            val content = documentService.getDocumentContent(id)
            val name = documentService.getDocumentName(id)
            val document = documentService.getDocumentById(id)
            DocumentUpdate(id, name, content, document.get().creator.username)
        } catch (e: RuntimeException) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found", e)
        }
    }

    @PostMapping("/renameDocument")
    fun renameDocument(@RequestBody request: RenameRequest): ResponseEntity<RenameRequest> {
        documentService.renameDocument(request)
        return ResponseEntity.ok(request)
    }

    @PostMapping("/newDocument")
    fun newDocument(@RequestBody request: NewDocumentRequest): ResponseEntity<Document> {
        val document = documentService.createDocument(request.name, request.creatorId)
        return ResponseEntity.ok(document)
    }

    @GetMapping("/downloadTxt/{id}")
    fun downloadTxt(response: HttpServletResponse, @PathVariable id: Long) {
        try {
            val content = documentService.downloadTxt(id)
            response.contentType = "text/plain"
            response.setHeader("Content-Disposition", "attachment; filename=document.txt")
            response.outputStream.write(content)
        } catch (e: RuntimeException) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found", e)
        }
    }

    @GetMapping("/listDocuments")
    fun listDocuments(): ResponseEntity<List<Document>> {
        val a = documentService.listDocuments()
        return ResponseEntity.ok(a)
    }


    @GetMapping("/userInfo")
    fun getUserInfo(@RequestHeader("Authorization") token: String): ResponseEntity<User> {
        val jwt = token.substring(7)
        val username = jwtService.extractUsername(jwt)
        val user = userRepository.findByUsername(username)
            .orElseThrow { RuntimeException("User not found") }
        return ResponseEntity.ok(user)
    }

    @DeleteMapping("/deleteDocument/{id}")
    fun deleteDocument(@PathVariable id: Long): ResponseEntity<Long> {
        return try {
            documentService.deleteDocument(id)
            ResponseEntity.ok(id)
        } catch (e: RuntimeException) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found", e)
        }
    }

}