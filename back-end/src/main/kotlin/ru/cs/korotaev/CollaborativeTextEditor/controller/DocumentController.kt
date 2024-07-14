package ru.cs.korotaev.CollaborativeTextEditor.controller

import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.messaging.handler.annotation.DestinationVariable
import org.springframework.messaging.handler.annotation.MessageMapping
import org.springframework.messaging.handler.annotation.Payload
import org.springframework.messaging.handler.annotation.SendTo
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestBody
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.web.server.ResponseStatusException
import ru.cs.korotaev.CollaborativeTextEditor.dto.ActiveUserDTO
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
@Tag(name = "Document Controller", description = "Контроллер для управления документами")
class DocumentController(
    private val documentService: DocumentService,
    private val jwtService: JwtService,
    private val userRepository: UserRepository
){

    @MessageMapping("/updateDocument/{id}")
    @SendTo("/topic/updates/{id}")
    @Operation(summary = "Обновление документа", description = "Отправка обновлений документа по WebSocket")
    fun updateDocument(@DestinationVariable id: Long, update: DocumentUpdate): DocumentUpdate {
        return documentService.updateDocument(update)
    }

    @MessageMapping("/activeUsers/{documentId}")
    @SendTo("/topic/activeUsers/{documentId}")
    @Operation(summary = "Активные пользователи", description = "Обновление списка активных пользователей по WebSocket")
    fun handleActiveUsers(@DestinationVariable documentId: Long, @Payload activeUserDTO: ActiveUserDTO) {
        val username = documentService.getActiveUserUsernameById(activeUserDTO.userId)
        val action = activeUserDTO.action

        if (action == "connect") {
            documentService.addActiveUser(documentId, username)
        } else if (action == "disconnect") {
            documentService.removeActiveUser(documentId, username)
        }
    }

    @GetMapping("/activeUsers/{id}")
    @Operation(summary = "Получение активных пользователей", description = "Получение списка активных пользователей для документа")
    fun getActiveUsers(@PathVariable id: Long): List<String> {
        return documentService.getActiveUsers(id)
    }

    @GetMapping("/getDocument/{id}")
    @Operation(summary = "Получение документа", description = "Получение содержимого документа по ID")
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
    @Operation(summary = "Переименование документа", description = "Изменение имени документа")
    fun renameDocument(@RequestBody request: RenameRequest): ResponseEntity<RenameRequest> {
        documentService.renameDocument(request)
        return ResponseEntity.ok(request)
    }

    @PostMapping("/newDocument")
    @Operation(summary = "Создание нового документа", description = "Создание нового документа с заданным именем и ID создателя")
    fun newDocument(@RequestBody request: NewDocumentRequest): ResponseEntity<Document> {
        val document = documentService.createDocument(request.name, request.creatorId)
        return ResponseEntity.ok(document)
    }

    @GetMapping("/downloadTxt/{id}")
    @Operation(summary = "Скачать документ в формате TXT", description = "Скачивание содержимого документа в формате TXT")
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
    @Operation(summary = "Получение списка документов", description = "Получение списка всех документов")
    fun listDocuments(): ResponseEntity<List<Document>> {
        val a = documentService.listDocuments()
        return ResponseEntity.ok(a)
    }


    @GetMapping("/userInfo")
    @Operation(summary = "Получение информации о пользователе", description = "Получение информации о пользователе по JWT токену")
    fun getUserInfo(@RequestHeader("Authorization") token: String): ResponseEntity<User> {
        val jwt = token.substring(7)
        val username = jwtService.extractUsername(jwt)
        val user = userRepository.findByUsername(username)
            .orElseThrow { RuntimeException("User not found") }
        return ResponseEntity.ok(user)
    }

    @DeleteMapping("/deleteDocument/{id}")
    @Operation(summary = "Удаление документа", description = "Удаление документа по ID")
    fun deleteDocument(@PathVariable id: Long): ResponseEntity<Long> {
        return try {
            documentService.deleteDocument(id)
            ResponseEntity.ok(id)
        } catch (e: RuntimeException) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found", e)
        }
    }

}