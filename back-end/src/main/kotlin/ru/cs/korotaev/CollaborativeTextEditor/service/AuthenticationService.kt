package ru.cs.korotaev.CollaborativeTextEditor.service

import org.springframework.beans.factory.annotation.Autowired
import org.springframework.security.authentication.AuthenticationManager
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import ru.cs.korotaev.CollaborativeTextEditor.dto.AuthenticationRequest
import ru.cs.korotaev.CollaborativeTextEditor.dto.AuthenticationResponse
import ru.cs.korotaev.CollaborativeTextEditor.dto.RegisterRequest
import ru.cs.korotaev.CollaborativeTextEditor.model.Role
import ru.cs.korotaev.CollaborativeTextEditor.model.User
import ru.cs.korotaev.CollaborativeTextEditor.repository.RoleRepository
import ru.cs.korotaev.CollaborativeTextEditor.repository.UserRepository

@Service
class AuthenticationService @Autowired constructor(
    private val repository: UserRepository,
    private val jwtService: JwtService,
    private val passwordEncoder: PasswordEncoder,
    private val authenticationManager: AuthenticationManager,
    private val roleRepository: RoleRepository
) {

    fun register(request: RegisterRequest): AuthenticationResponse {
        val role = roleRepository.findByName("USER") ?: roleRepository.save(Role(id = 0, name = "USER"))
        val user = User(
            0,
            role,
            request.username,
            passwordEncoder.encode(request.password)
        )
        repository.save(user)
        val jwtToken = jwtService.generateToken(user)
        return AuthenticationResponse(jwtToken, user)
    }

    fun authenticate(request: AuthenticationRequest): AuthenticationResponse {
        authenticationManager.authenticate(
            UsernamePasswordAuthenticationToken(
                request.username, request.password
            )
        )
        val user = repository.findByUsername(request.username).orElseThrow()
        val jwtToken = jwtService.generateToken(user)
        return AuthenticationResponse(jwtToken, user)
    }
}