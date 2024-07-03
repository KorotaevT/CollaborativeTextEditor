package ru.cs.korotaev.CollaborativeTextEditor.controller

import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.messaging.handler.annotation.MessageMapping
import org.springframework.messaging.handler.annotation.SendTo
import org.springframework.web.bind.annotation.*
import org.springframework.web.server.ResponseStatusException
import ru.cs.korotaev.CollaborativeTextEditor.dto.DocumentUpdate
import ru.cs.korotaev.CollaborativeTextEditor.dto.RenameRequest
import ru.cs.korotaev.CollaborativeTextEditor.service.DocumentService

@RestController
@RequestMapping("/api")
class DocumentController(private val documentService: DocumentService) {

    @MessageMapping("/updateDocument")
    @SendTo("/topic/updates")
    fun updateDocument(update: DocumentUpdate): DocumentUpdate {
        return documentService.updateDocument(update)
    }

    @GetMapping("/getDocument/{fileName}")
    fun getDocument(@PathVariable fileName: String): DocumentUpdate {
        return try {
            val content = documentService.getDocumentContent(fileName)
            DocumentUpdate(fileName, content)
        } catch (e: RuntimeException) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Файл не найден", e)
        }
    }

    @PostMapping("/renameDocument")
    fun renameDocument(@RequestBody request: RenameRequest): ResponseEntity<Any> {
        documentService.renameDocument(request.oldName, request.newName)
        return ResponseEntity.ok().build()
    }

    @PostMapping("/newDocument/{newName}")
    fun newDocument(@PathVariable newName: String): ResponseEntity<Any> {
        documentService.createDocument(newName)
        return ResponseEntity.ok().build()
    }

    @GetMapping("/downloadTxt")
    fun downloadTxt(response: HttpServletResponse) {
        documentService.downloadTxt(response)
    }

    @GetMapping("/listDocuments")
    fun listDocuments(): ResponseEntity<List<String>> {
        return ResponseEntity.ok(documentService.listDocuments())
    }

}