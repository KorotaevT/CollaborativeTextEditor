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


    @GetMapping("/getDocument/{id}")
    fun getDocument(@PathVariable id: Long): DocumentUpdate {
        return try {
            val content = documentService.getDocumentContent(id)
            val name = documentService.getDocumentName(id)
            val document = documentService.getDocumentById(id)
            DocumentUpdate(id, name, content, document.get().creator.username)
        } catch (e: RuntimeException) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Файл не найден", e)
        }
    }

    @PostMapping("/renameDocument")
    fun renameDocument(@RequestBody request: RenameRequest): ResponseEntity<Any> {
        documentService.renameDocument(request)
        return ResponseEntity.ok().build()
    }

    @PostMapping("/newDocument")
    fun newDocument(@RequestBody request: NewDocumentRequest): ResponseEntity<Document> {
        val document = documentService.createDocument(request.name, request.creatorId)
        return ResponseEntity.ok(document)
    }

    @GetMapping("/downloadTxt/{id}")
    fun downloadTxt(response: HttpServletResponse, @PathVariable id: Long) {
        documentService.downloadTxt(response, id)
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
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Документ не найден", e)
        }
    }

}